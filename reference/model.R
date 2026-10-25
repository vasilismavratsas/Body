# =============================================================================
# Body — phase alpha model, v0.6.1(base R only, no packages)   [v0.5 = model_v5.R]
# -----------------------------------------------------------------------------
# For each of 8 coarse body parts: how many times more muscular work did the
# user do today than a typical non-exercising American does in a day?
#
#   Work      W_p = sum_a (MET_a - 1) * minutes_a * share_{a,p}    (net MET-min)
#   Baseline  B_p = same formula on the non-exerciser day
#   Offset    F_p = phi * massFraction_p * sum_p B_p
#   Multiple  M_p = (W_p + F_p) / (B_p + F_p)        (v0.3b: replaces max-floor)
#
# Inputs (v0.6.1: Body Researcher round 1 + v1.1, IPUMS baseline v2): activation_shares_v1.1.csv,
# postural_shares_v1.1.csv (O'Sullivan 2006 sitting lower back), muscle_mass_8part_v1.csv, nonexerciser_baseline_v2.csv + atus_nonexercisers_v2.csv
# (IPUMS ATUS 2024, adults 18+, WT06-weighted aggregates only; raw microdata not read),
# mets.csv (Compendium METs for the scenario exercises only).
# Superseded files (README_SUPERSEDED.md) are NOT read.
# Every number not in those files is in the ASSUMPTION block below.
# Run:  Rscript model.R
# =============================================================================
set.seed(2026); options(width = 200)
here  <- if (dir.exists("/workspace/body")) "/workspace/body" else "."
parts <- c("arms","shoulders","chest","upper_back","core","lower_back","hips_glutes","legs")

# =============================================================================
# 0. ASSUMPTION PARAMETERS  (nothing here comes from a cited file)
# =============================================================================
A <- list()

# A1. Dirichlet concentration PER CELL, chosen by the cell's status label.
#     For activity a, alpha_{a,p} = kappa(status_{a,p}) * sbar_{a,p}.
#     Rethinking intuition: kappa acts like a "pseudo-sample size". With all cells
#     at one kappa this is the usual Dirichlet(kappa * sbar); mixing kappas means
#     confident cells wobble less, guessed cells wobble more. (Side effect: the
#     mean is no longer exactly sbar; it tilts toward low-kappa cells. Reported below.)
A$kappa <- c(cited = 50, stand_in = 20, ASSUMPTION = 5)
#     Status strings in the files -> one of the three classes above:
status_class <- function(s) ifelse(grepl("^cited", s), "cited",
                             ifelse(grepl("^stand-in", s), "stand_in", "ASSUMPTION"))

# A2. Which share row each baseline (ATUS) category uses. The researcher gave
#     postural rows (sitting/standing/lying) and activity rows, but no mapping
#     from ATUS categories to rows, so this mapping is ASSUMED.
A$base_row <- c(
  sleep = "lying",
  tv = "sitting", eating = "sitting", work = "sitting", education = "sitting",
  hh_management = "sitting", org_civic_religious = "sitting", socializing = "sitting",
  phone_mail = "sitting", other_leisure_residual = "sitting", other_nec = "sitting",
  sports_exercise = "sitting",          # researcher reassigned this to sitting (07021)
  personal_care_nonsleep = "standing",
  housework = "household", food_prep = "household", hh_other_residual = "household",
  care_household = "household", care_nonhousehold = "household",
  lawn_garden = "gardening",
  purchasing = "walking")

# A3. Scenario exercises: Compendium id (mets.csv) -> share row (ASSUMED pairing).
#     indoor_biking is wired as Compendium 01200 (6.8 MET), using the cycling shares (v0.5+)
#     (would need a MET; not invented).
A$exercise <- data.frame(
  activity_id = c("walk_brisk", "jog",     "resist_multi",  "bike_leisure", "indoor_bike_general",
                  "calisthenics_mod", "yoga_hatha", "garden",    "chore_clean_light"),
  row         = c("walking",    "running", "weightlifting", "bicycling",     "indoor_biking",
                  "calisthenics",     "yoga",       "gardening", "household"),
  stringsAsFactors = FALSE)

# A4. MET uncertainty: Compendium SD is GAP -> ASSUMED CV of 0.20 on the MET scale.
#     A CV is not a log-SD. For a lognormal, CV^2 = exp(sdlog^2) - 1, so
#     sdlog = sqrt(log(1 + CV^2)) = 0.198 for CV 0.20 (v0.3b used 0.20 directly;
#     tiny numeric difference, but now the label is true).
#     MET ~ LogNormal(meanlog = log(MET_compendium), sdlog): the Compendium value
#     is the MEDIAN of the draw.
A$met_cv <- 0.20
met_sdlog <- sqrt(log(1 + A$met_cv^2))
#     Net energy rule (v0.4): activities whose nominal MET <= 1 (sleep 1.0, TV 1.0,
#     sitting 1.0) are AT REST by definition, so net = 0 exactly and they get no
#     MET noise. Otherwise noise in MET would create positive net work from
#     resting (v0.3b: E[max(MET_draw - 1, 0)] > 0 even when MET = 1). For MET > 1,
#     net = max(MET_draw - 1, 0).
# A5. (v0.5) Baseline minutes now use REAL per-group weighted mean, SD and
#     participation (atus_nonexercisers_v2.csv). Zero-inflated Gamma per group:
#       participate ~ Bernoulli(pi);  if yes, minutes ~ Gamma(mean mu_c, sd s_c)
#       mu_c = mean / pi;  s_c^2 = (SD^2 + mean^2) / pi - mu_c^2
#     (moment-matched so the unconditional mean and SD equal the cited ones).
#     Then the day is rescaled to 1440. ASSUMPTIONS that remain: groups are drawn
#     independently (cross-group correlation not available), and the rescale to
#     1440 changes the per-group SDs somewhat. A$min_cv is no longer used.
#     (old:) minutes ~ Gamma(mean, CV = min_cv),
#     then the day is rescaled to 1440 min.
A$min_cv <- NA    # retired in v0.5
# A5b. (v0.6) DESIGN: the reference is the AVERAGE non-exerciser day. Baseline
#     minutes per group = cited weighted mean; its uncertainty is only the
#     SAMPLING ERROR of that mean: SE = SD / sqrt(n_eff), n_eff = n / deff.
#     deff = 1.5 is an ASSUMPTION for WT06 weighting (no replicate weights used).
#     Means are drawn as Gamma(mean, SE), then rescaled to 1440.
#     Day-to-day variation (the zero-inflated Gamma above) is used ONLY for the
#     optional typicality percentile, not for M.
A$deff <- 1.5
A$zero_inflate <- TRUE
# A6. Offset multiplier phi in F_p = phi * massFraction_p * sum_p B_p.
#     WHY AN OFFSET: adding the same pseudo-count F_p to work and baseline is
#     shrinkage toward 1x. Parts whose baseline work is tiny (chest, core) would
#     otherwise give wild ratios from tiny denominators; F_p acts like a prior
#     "imaginary baseline day" of work, so M_p only moves away from 1x when the
#     data (real work) are large relative to that prior -- the same logic as a
#     regularizing prior in Statistical Rethinking (ch. 7), or adding pseudo-counts
#     to a Beta/Dirichlet. Bigger phi = stronger pull to 1x. A day identical to
#     baseline gives exactly 1x for any phi.
A$phi <- 0.25
# A7. Colour bands (ASSUMPTION, final for alpha, v0.6.1): edges at 1.15, 1.4, 1.8.
#     green < 1.15 <= yellow-green < 1.4 <= orange < 1.8 <= red.
#     Continuous ramp on log2(M) from 1x (green) to M_cap = 2.5x (full red).
A$band_edges <- c(1.15, 1.4, 1.8)
A$band_names <- c("green", "yellow-green", "orange", "red")
A$M_cap <- 2.5
# A8. highUncertainty flag: log2(hi89 / lo89) > 2  (interval spans > 4x).
A$hu_log2 <- 2
# A9. Monte Carlo draws.
A$N <- 4000
# A10. Mass fractions: use the "average" row (researcher's mass_7 = 50/50 sex mix).
A$mass_sex <- "average"

# =============================================================================
# 1. LOAD DATA
# =============================================================================
rd  <- function(f) read.csv(file.path(here, f), stringsAsFactors = FALSE, colClasses = "character")
num <- function(x) suppressWarnings(as.numeric(x))       # "GAP" -> NA, never imputed

act  <- rd("activation_shares_v1.1.csv")
post <- rd("postural_shares_v1.1.csv")
mm   <- rd("muscle_mass_8part_v1.csv")
base <- rd("nonexerciser_baseline_v2.csv")
atv2 <- rd("atus_nonexercisers_v2.csv")
mets <- rd("mets.csv")

shares_long <- rbind(act, post)
shares_long$share <- num(shares_long$share)

# --- 1a. Share table: one row per activity/posture, columns = parts ---------
rows <- unique(shares_long$activity_id)
Sbar <- matrix(NA, length(rows), 8, dimnames = list(rows, parts))
Kap  <- Sbar
for (i in seq_len(nrow(shares_long))) {
  r <- shares_long[i, ]
  Sbar[r$activity_id, r$part] <- r$share
  Kap[r$activity_id, r$part]  <- A$kappa[[status_class(r$status)]]
}
stopifnot(!anyNA(Sbar))
rowsum_err <- abs(rowSums(Sbar) - 1)          # researcher says every row sums to 1
Sbar <- Sbar / rowSums(Sbar)                  # remove 4-decimal rounding only

# --- 1b. Mass fractions ------------------------------------------------------
mass <- setNames(num(mm$fraction[mm$sex == A$mass_sex]), mm$part[mm$sex == A$mass_sex])[parts]
mass_sum <- sum(mass)
mass <- mass / sum(mass)

# --- 1c. Baseline day (drop the TOTAL row) -----------------------------------
ref_net <- num(base$MET_h[base$activity_id == "TOTAL_net"])     # researcher: 9.2
base <- base[!grepl("^(TOTAL|per_person)", base$activity_id), ]
base$min <- num(base$mean_min_per_day); base$MET <- num(base$MET)
base <- merge(base, atv2[, c("activity_id","sd_min","participation_rate_pct")], by = "activity_id", sort = FALSE)
base$n <- num(atv2$n[match(base$activity_id, atv2$activity_id)])
base$se <- num(base$sd_min) / sqrt(base$n / A$deff)
base$sd <- num(base$sd_min); base$pi <- num(base$participation_rate_pct) / 100
if (!A$zero_inflate) base$pi <- 1
base$mu_c <- base$min / base$pi
base$sd_c <- sqrt(pmax((base$sd^2 + base$min^2) / base$pi - base$mu_c^2, 0))
stopifnot(all(base$sd_c > 0))
# Fix (v0.4): ATUS category means sum to 1440.6 (rounding in the published table).
# Rescale every category proportionally so the nominal day is exactly 1440 min:
# min_a <- min_a * 1440 / sum(min). (Each MC draw is also rescaled to 1440.)
raw_min_sum <- sum(base$min)
base$min <- base$min * 1440 / raw_min_sum
stopifnot(all(base$activity_id %in% names(A$base_row)))

# --- 1d. All activities the model knows: baseline categories + exercises -----
ex <- merge(A$exercise, mets[, c("activity_id", "compendium_code", "MET")], by = "activity_id")
ex$MET <- num(ex$MET)
acts  <- c(base$activity_id, ex$activity_id)
MET0  <- setNames(c(base$MET, ex$MET), acts)
rowOf <- setNames(c(A$base_row[base$activity_id], ex$row), acts)

# =============================================================================
# 2. CORE FUNCTIONS
# =============================================================================
# Dirichlet via normalised Gammas (the standard trick; Rethinking ch. on simplexes)
rdirichlet1 <- function(alpha) { g <- rgamma(length(alpha), alpha, 1); g / sum(g) }
# Gamma with given mean m and coefficient of variation cv: shape = 1/cv^2
# Gamma from mean m and SD s: shape = (m/s)^2, rate = m/s^2; zero-inflated by pi
rzigamma <- function(m, s, p) ifelse(runif(length(m)) < p, rgamma(length(m), (m / s)^2, m / s^2), 0)
rgamma_mcv  <- function(m, cv) ifelse(m > 0, rgamma(length(m), 1 / cv^2, 1 / (cv^2 * m)), 0)

# extra = named exercise minutes swapped in for TV on the MEAN baseline day of
# this draw (same METs, shares and mean minutes for W and B -> sedentary = 1x).
# Also returns, per draw, one simulated INDIVIDUAL non-exerciser day (v0.5
# zero-inflated Gamma) using the same METs/shares, for the typicality percentile.
rgamma_ms <- function(m, s) rgamma(length(m), (m / s)^2, m / s^2)
simulate_day <- function(extra = NULL, N = A$N, phi = A$phi) {
  M <- Mraw <- FB <- Wm <- Bind <- matrix(NA, N, 8, dimnames = list(NULL, parts))
  gross_ind <- numeric(N)
  for (i in 1:N) {
    MET <- exp(rnorm(length(acts), log(MET0), met_sdlog))
    net <- ifelse(MET0 <= 1, 0, pmax(MET - 1, 0))   # resting activities: net = 0
    Srow <- t(sapply(rows, function(r) rdirichlet1(Kap[r, ] * Sbar[r, ])))
    dimnames(Srow) <- list(rows, parts)
    S <- Srow[rowOf, , drop = FALSE]
    # (iii) MEAN baseline minutes: sampling error of the weighted mean only
    bm <- setNames(rep(0, length(acts)), acts)
    bm[base$activity_id] <- rgamma_ms(base$min, base$se)
    bm <- bm / sum(bm) * 1440
    B  <- drop((net * bm) %*% S)
    um <- bm
    if (length(extra)) {
      um["tv"] <- max(um["tv"] - sum(extra), 0)
      um[names(extra)] <- um[names(extra)] + extra
    }
    W  <- drop((net * um) %*% S)
    Fp <- phi * mass * sum(B)                 # additive offset (pseudo-count)
    M[i, ]    <- (W + Fp) / (B + Fp)
    Mraw[i, ] <- W / B
    FB[i, ]   <- Fp > B
    Wm[i, ]   <- W
    # (iv) one INDIVIDUAL non-exerciser day (day-to-day spread) for typicality
    im <- setNames(rep(0, length(acts)), acts)
    im[base$activity_id] <- rzigamma(base$mu_c, base$sd_c, base$pi)
    im <- im / sum(im) * 1440
    Bind[i, ] <- drop((net * im) %*% S)
    gross_ind[i] <- sum(im * MET0) / 60      # nominal METs, comparable to cited gross
  }
  list(M = M, Mraw = Mraw, FB = FB, W = Wm, Bind = Bind, gross_ind = gross_ind)
}
# Typicality percentile (optional output): share of individual non-exerciser
# days whose part work is below the user's median part work.
typicality <- function(sim) round(100 * sapply(parts, function(p) mean(sim$Bind[, p] < median(sim$W[, p]))), 0)

band_of <- function(M) A$band_names[findInterval(M, A$band_edges) + 1]
# straddlesCutoff (v0.6.1): the 89% interval spans >= 2 band edges (lo < edge <= hi)
straddles <- function(lo, hi) sapply(seq_along(lo), function(i) sum(lo[i] < A$band_edges & A$band_edges <= hi[i]) >= 2)
color_of <- function(M) {
  x <- pmin(pmax(log2(M), 0) / log2(A$M_cap), 1)
  rgb(colorRamp(c("#2E7D32", "#FBC02D", "#C62828"))(x), maxColorValue = 255)
}
summarise <- function(sim) {
  q <- t(apply(sim$M, 2, quantile, c(.055, .5, .945)))     # 89% interval
  data.frame(part = parts, lo89 = round(q[,1], 2), median = round(q[,2], 2),
             hi89 = round(q[,3], 2), band = band_of(q[,2]), color = color_of(q[,2]),
             straddlesCutoff = straddles(q[,1], q[,3]),
             log2_hi_lo = round(log2(q[,3] / q[,1]), 2),
             highUncertainty = log2(q[,3] / q[,1]) > A$hu_log2,
             offset_gt_B = round(colMeans(sim$FB), 3),
             typ_pct = typicality(sim))
}

# =============================================================================
# 3. SCENARIOS (ASSUMED: built from the ATUS mean day by swapping TV time)
# =============================================================================
days <- list(sedentary = NULL,                       # literally the baseline day
             walk30    = c(walk_brisk = 30),
             run45     = c(jog = 45),
             lift45    = c(resist_multi = 45),
             bike45    = c(bike_leisure = 45),
             ibike45   = c(indoor_bike_general = 45),
             calis45   = c(calisthenics_mod = 45),
             yoga45    = c(yoga_hatha = 45),
             garden45  = c(garden = 45),
             house45   = c(chore_clean_light = 45))
sink(file.path(here, "demo_output_v6.txt"), split = TRUE)
cat("Body model v0.6.1 —", format(Sys.time()), "\n")
cat(sprintf("Raw ATUS minutes %.1f rescaled to %.1f\n", raw_min_sum, sum(base$min)))
cat(sprintf("Deterministic baseline net = %.3f MET-h/day (researcher TOTAL_net %.2f)\n", sum(base$min * pmax(base$MET - 1, 0)) / 60, ref_net))
cat("Inputs: activation/postural_shares_v1.1, muscle_mass_8part_v1 (average), nonexerciser_baseline_v2 + atus_nonexercisers_v2 (IPUMS 18+), mets.csv\n")
cat(sprintf("Baseline minutes sum = %.1f; gross = %.2f MET-h/day; net = %.2f MET-h/day\n",
            sum(base$min), sum(base$min * base$MET) / 60, sum(base$min * (base$MET - 1)) / 60))
cat(sprintf("Mass fractions (%s) summed to %.4f before renormalising\n", A$mass_sex, mass_sum))
cat(sprintf("Max share row-sum error before renormalising: %.4f\n", max(rowsum_err)))
cat("Exercise METs: "); cat(sprintf("%s(%s)=%.1f ", ex$activity_id, ex$compendium_code, ex$MET)); cat("\n")
cat(sprintf("ASSUMPTIONS: kappa cited/stand-in/ASSUMPTION = %s; MET CV %.2f (sdlog %.3f); baseline = mean day, SE with deff %.1f; phi %.2f (offset); M_cap %g; N %d\n",
            paste(A$kappa, collapse = "/"), A$met_cv, met_sdlog, A$deff, A$phi, A$M_cap, A$N))
cat("\nColumns: median and 89% interval of M; band = ASSUMPTION band (final for alpha) of the median;\nstraddlesCutoff = 89% interval spans >= 2 band edges; highUncertainty = log2(hi/lo) > 2;\n",
    "offset_gt_B = share of draws where offset F_p exceeds baseline B_p;\ntyp_pct = typicality percentile vs individual non-exerciser days (day-to-day spread).\n", sep = "")
# --- Calibration of individual-day spread vs cited per-person gross MET-h ---
cal <- simulate_day(NULL)$gross_ind
cat(sprintf("\nCalibration (individual days, gross MET-h/day): SD %.2f (cited 4.40); p10 %.2f (28.22); p50 %.2f (32.60); p90 %.2f (38.80)\n",
            sd(cal), quantile(cal, .1), quantile(cal, .5), quantile(cal, .9)))
res <- list()
for (d in names(days)) {
  cat("\n=== Scenario:", d, "===\n")
  res[[d]] <- summarise(simulate_day(days[[d]]))
  print(res[[d]], row.names = FALSE)
}
cat("\n=== Sensitivity: run45 medians by phi (ASSUMPTION) ===\n")
sens <- sapply(c(0.05, 0.25, 0.5), function(ph) {
  set.seed(2026); round(apply(simulate_day(days$run45, phi = ph)$M, 2, median), 2) })
colnames(sens) <- paste0("phi=", c(0.05, 0.25, 0.5)); print(sens)
sink()

