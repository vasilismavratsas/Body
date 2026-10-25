# =============================================================================
# Body — phase alpha model, v0.7 (base R only, no packages)   [v0.6.1 = model_v6.R]
# -----------------------------------------------------------------------------
# For each of 8 coarse body parts: how many times more muscular work did the
# user do today than a typical non-exercising American does in a day?
#
#   Work      W_p = sum_a (MET_a - 1) * minutes_a * share_{a,p}    (net MET-min)
#   Baseline  B_p = same formula on the non-exerciser day
#   Offset    F_p = phi * massFraction_p * sum_p B_p
#   Multiple  M_p = (W_p + F_p) / (B_p + F_p)
#
# v0.7 changes
#  * DATA-DRIVEN activity list: no activity names in the logic. Activities come
#    from activity_catalog.csv (id -> share row -> MET file), shares from
#    activation_shares_v2.1.csv + postural_shares_v1.1.csv, METs from mets.csv
#    and activities25_mets.csv, baseline row mapping from baseline_row_map.csv.
#  * WEIGHTLIFTING: parent "weightlifting" with child lifts (lift_shares.csv,
#    lift_mets.csv, both derived verbatim from the Researcher's lifts_v1.1.csv by
#    derive_lift_tables.R). User input = exercise + minutes + intensity.
#  * SHARE RULE (ASSUMPTION, Body decision 2026-10-24): share = active mass x
#    activation on ONE scale (%MVIC). Assumed indices (0-50 scale: prime 50 /
#    secondary 20 / stabilizer 10 / other 2) are rescaled x2 onto %MVIC
#    (100/40/20/4); cited and stand-in indices are already %MVIC. Then
#    share_p = mass_p * index_p / sum_q(mass_q * index_q), for EVERY row, no
#    special case. The metric is energy, so a big part doing moderate work can
#    out-spend a small part working hard; share order need not match EMG order.
#  * MET uncertainty per activity: rows with a published min-max range across
#    Compendium codes treat the range as an 89% lognormal interval (ASSUMPTION);
#    other rows keep CV 0.20.
#  * Inputs are VALIDATED with clear error messages (validate_* functions).
# Raw IPUMS microdata are never read (aggregates only).
# Run:  Rscript model.R            (writes demo_output_v7.txt)
#       BODY_LIB=1 -> source() only defines the model (used by check_bands_v07.R)
# =============================================================================
set.seed(2026); options(width = 200)
here  <- if (nzchar(Sys.getenv("BODY_DIR"))) Sys.getenv("BODY_DIR") else if (dir.exists("/workspace/body")) "/workspace/body" else "."
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


# A2/A3 (v0.7): the baseline-category -> share-row mapping and the exercise ->
#     share-row pairing are no longer hard-coded. They live (unchanged, still
#     ASSUMPTION) in baseline_row_map.csv and activity_catalog.csv.

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
# A11. (v0.7) Share rule: factor that puts assumed activation indices on the %MVIC
#      scale (option B). ASSUMPTION: prime 50 -> 100 %MVIC, i.e. linear x2.
A$assumed_index_scale <- 2
#      A published Compendium MET range is read as the 89% interval of a lognormal
#      (z = qnorm(0.945) = 1.598). ASSUMPTION: a range across codes is NOT an SD.
A$range_as_interval <- 0.89
#      User-day swap: logged minutes replace this baseline category (ASSUMPTION).
A$swap_from <- "tv"
#      Valid intensity levels for lifts and the default when none is given.
A$intensities <- c("light", "moderate", "vigorous")
#      Selection rows with unweighted n below this get a lowN flag (data quality).
A$lowN <- 10
# A12. (v0.7 LOCKED) Body adopted P1 (phi 0.25, bands kept) and P2 (saturated flag:
#      median M >= M_cap -> UI shows '>2.5x'); P3 (phi 0.5) rejected.

# =============================================================================
# 1. LOAD + VALIDATE DATA
# =============================================================================
rd  <- function(f) {
  p <- file.path(here, f)
  if (!file.exists(p)) stop(sprintf("Input file missing: %s", p), call. = FALSE)
  read.csv(p, stringsAsFactors = FALSE, colClasses = "character")
}
num <- function(x) suppressWarnings(as.numeric(x))       # "GAP" -> NA, never imputed
fail <- function(...) stop(sprintf(...), call. = FALSE)
need_cols <- function(d, cols, f) {
  miss <- setdiff(cols, names(d))
  if (length(miss)) fail("%s: missing column(s) %s", f, paste(miss, collapse = ", "))
}
valid_status <- function(s) grepl("^(cited|stand-in|ASSUMPTION)", s)

# validate_shares: long table (id, part, index, mass, status). Checks: all 8
# parts exactly once per id, status valid, index >= 0 and not all 0, mass > 0,
# and the Researcher's stored share column (if any) sums to 1 +- 0.002.
validate_shares <- function(d, idcol, f) {
  need_cols(d, c(idcol, "part", "index_pctMVC", "mass_fraction", "status"), f)
  for (id in unique(d[[idcol]])) {
    r <- d[d[[idcol]] == id, ]
    if (!setequal(r$part, parts) || nrow(r) != 8)
      fail("%s: '%s' must have exactly the 8 parts once each; has: %s", f, id, paste(r$part, collapse = ","))
    bad <- r$status[!valid_status(r$status)]
    if (length(bad)) fail("%s: '%s' has invalid status '%s' (allowed: cited / stand-in / ASSUMPTION)", f, id, bad[1])
    ix <- num(r$index_pctMVC); ms <- num(r$mass_fraction)
    if (anyNA(ix) || any(ix < 0) || sum(ix) == 0) fail("%s: '%s' index_pctMVC must be numbers >= 0, not all 0", f, id)
    if (anyNA(ms) || any(ms <= 0)) fail("%s: '%s' mass_fraction must be > 0", f, id)
    if ("share" %in% names(r) && abs(sum(num(r$share)) - 1) > 0.002)
      fail("%s: '%s' stored shares sum to %.4f, not 1", f, id, sum(num(r$share)))
  }
  invisible(TRUE)
}
validate_met <- function(m, id, f) {
  if (is.na(m) || m <= 0) fail("%s: activity '%s' needs MET > 0 (got '%s'; GAP is not allowed for a wired activity)", f, id, m)
}

# Option B share rule (see header). Returns a matrix rows x parts, plus kappa.
# 'rule' lets check_bands_v07.R run the A/C sensitivity: "B" (adopted), "A"
# (EMG-cited rows: index only, no mass), "C" (index only, no mass, every row).
make_shares <- function(d, idcol, rule = "B") {
  ids <- unique(d[[idcol]])
  S <- K <- matrix(NA, length(ids), 8, dimnames = list(ids, parts))
  for (id in ids) {
    r  <- d[d[[idcol]] == id, ]; r <- r[match(parts, r$part), ]
    ix <- num(r$index_pctMVC); ms <- num(r$mass_fraction)
    assumed <- status_class(r$status) == "ASSUMPTION"
    ix[assumed] <- ix[assumed] * A$assumed_index_scale   # one %MVIC scale
    has_emg <- any(grepl("^cited", r$status))
    w <- if (rule == "C" || (rule == "A" && has_emg)) ix else ix * ms
    S[id, ] <- w / sum(w)
    K[id, ] <- A$kappa[status_class(r$status)]
  }
  list(S = S, K = K)
}

act  <- rd("activation_shares_v2.1.csv"); validate_shares(act,  "activity_id", "activation_shares_v2.1.csv")
post <- rd("postural_shares_v1.1.csv");   validate_shares(post, "activity_id", "postural_shares_v1.1.csv")
lsh  <- rd("lift_shares.csv");            validate_shares(lsh,  "exercise_id", "lift_shares.csv")
lmet <- rd("lift_mets.csv")
need_cols(lmet, c("exercise_id", "intensity", "compendium_code", "MET", "is_default"), "lift_mets.csv")
cat_ <- rd("activity_catalog.csv"); need_cols(cat_, c("activity_id", "share_row", "met_file", "met_id"), "activity_catalog.csv")
bmap <- rd("baseline_row_map.csv")
mm   <- rd("muscle_mass_8part_v1.csv")
base <- rd("nonexerciser_baseline_v2.csv")
atv2 <- rd("atus_nonexercisers_v2.csv")
mets <- rd("mets.csv")
m25  <- rd("activities25_mets.csv")
sel  <- rd("activities25_selection.csv")

# --- 1a. Share matrix: activities, postures, then lifts (prefixed "lift:") ----
build_shares <- function(rule = "B") {
  s1 <- make_shares(rbind(act[, c("activity_id","part","index_pctMVC","mass_fraction","status")],
                          post[, c("activity_id","part","index_pctMVC","mass_fraction","status")]),
                    "activity_id", rule)
  s2 <- make_shares(lsh, "exercise_id", rule)
  rownames(s2$S) <- rownames(s2$K) <- paste0("lift:", rownames(s2$S))
  list(S = rbind(s1$S, s2$S), K = rbind(s1$K, s2$K))
}
sh <- build_shares("B"); Sbar <- sh$S; Kap <- sh$K; rows <- rownames(Sbar)
rowsum_err <- 0   # v0.7: shares are recomputed from index x mass, sum to 1 exactly

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
miss <- setdiff(base$activity_id, bmap$activity_id)
if (length(miss)) fail("baseline_row_map.csv: no share row for baseline group(s) %s", paste(miss, collapse = ", "))

# --- 1d. All activities: baseline groups + catalog activities + lift x intensity
z89 <- qnorm(0.5 + A$range_as_interval / 2)
cat_met <- function(id, f) {
  if (f == "mets.csv") {
    m <- num(mets$MET[mets$activity_id == id]); validate_met(m[1], id, f)
    c(MET = m[1], sdlog = met_sdlog, code = mets$compendium_code[mets$activity_id == id][1])
  } else if (f == "activities25_mets.csv") {
    r <- m25[m25$activity_id == id, ]
    if (!nrow(r)) fail("%s: no row for '%s'", f, id)
    m <- num(r$default_MET); validate_met(m, id, f)
    rg <- num(regmatches(r$MET_range_across_codes, gregexpr("[0-9.]+", r$MET_range_across_codes))[[1]][1:2])
    sdl <- if (!anyNA(rg) && rg[2] > rg[1]) log(rg[2] / rg[1]) / (2 * z89) else met_sdlog
    c(MET = m, sdlog = sdl, code = r$default_code)
  } else fail("activity_catalog.csv: unknown met_file '%s' for '%s'", f, id)
}
bad <- setdiff(cat_$share_row, rows)
if (length(bad)) fail("activity_catalog.csv: share_row(s) not in share files: %s", paste(bad, collapse = ", "))
ex <- do.call(rbind, lapply(seq_len(nrow(cat_)), function(i) {
  v <- cat_met(ifelse(nzchar(cat_$met_id[i]), cat_$met_id[i], cat_$activity_id[i]), cat_$met_file[i])
  data.frame(activity_id = cat_$activity_id[i], row = cat_$share_row[i], code = v[["code"]],
             MET = num(v[["MET"]]), sdlog = num(v[["sdlog"]]), stringsAsFactors = FALSE)
}))
lmet$MET <- num(lmet$MET)
bad <- setdiff(unique(lmet$exercise_id), sub("^lift:", "", rows[grepl("^lift:", rows)]))
if (length(bad)) fail("lift_mets.csv: exercise(s) without shares in lift_shares.csv: %s", paste(bad, collapse = ", "))
for (i in seq_len(nrow(lmet))) {
  validate_met(lmet$MET[i], paste(lmet$exercise_id[i], lmet$intensity[i]), "lift_mets.csv")
  if (!lmet$intensity[i] %in% A$intensities) fail("lift_mets.csv: intensity '%s' not in %s", lmet$intensity[i], paste(A$intensities, collapse = "/"))
}
lx <- data.frame(activity_id = paste0("lift:", lmet$exercise_id, ":", lmet$intensity),
                 row = paste0("lift:", lmet$exercise_id), code = lmet$compendium_code,
                 MET = lmet$MET, sdlog = met_sdlog, stringsAsFactors = FALSE)
allx  <- rbind(ex, lx)
acts  <- c(base$activity_id, allx$activity_id)
MET0  <- setNames(c(base$MET, allx$MET), acts)
SDL   <- setNames(c(rep(met_sdlog, nrow(base)), allx$sdlog), acts)
rowOf <- setNames(c(bmap$share_row[match(base$activity_id, bmap$activity_id)], allx$row), acts)
lowN_ids <- sel$activity_id[num(sel$unweighted_n) < A$lowN]

# --- 1e. INPUT CONTRACT --------------------------------------------------------
# A user day is a data.frame with columns activity, minutes, and (lifts only)
# exercise + intensity, e.g.
#   data.frame(activity = c("tennis", "weightlifting"), minutes = c(60, 30),
#              exercise = c(NA, "biceps_curl"), intensity = c(NA, "vigorous"))
# Missing intensity for a lift -> that lift's is_default level in lift_mets.csv.
# activity = "weightlifting" with no exercise -> generic resist_multi row (catalog).
as_extra <- function(day) {
  if (is.null(day) || !nrow(day)) return(NULL)
  if (is.null(day$exercise))  day$exercise  <- NA
  if (is.null(day$intensity)) day$intensity <- NA
  key <- character(nrow(day))
  for (i in seq_len(nrow(day))) {
    a <- day$activity[i]; m <- num(day$minutes[i])
    if (is.na(m) || m < 0 || m > 1440) fail("input row %d: minutes must be 0-1440", i)
    if (a == "weightlifting" && !is.na(day$exercise[i])) {
      e <- day$exercise[i]; it <- day$intensity[i]
      if (!e %in% lmet$exercise_id) fail("input row %d: unknown lift '%s' (known: %s)", i, e, paste(unique(lmet$exercise_id), collapse = ", "))
      if (is.na(it)) it <- lmet$intensity[lmet$exercise_id == e & lmet$is_default == "TRUE"][1]
      if (!it %in% A$intensities) fail("input row %d: intensity must be light/moderate/vigorous", i)
      key[i] <- paste0("lift:", e, ":", it)
    } else {
      if (a == "weightlifting") a <- cat_$activity_id[cat_$share_row == "weightlifting"][1]
      if (!a %in% ex$activity_id) fail("input row %d: unknown activity '%s'", i, a)
      key[i] <- a
    }
  }
  tapply(num(day$minutes), key, sum)
}

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
simulate_day <- function(day = NULL, N = A$N, phi = A$phi) {
  extra <- if (is.data.frame(day)) as_extra(day) else day
  M <- Mraw <- FB <- Wm <- Bind <- matrix(NA, N, 8, dimnames = list(NULL, parts))
  gross_ind <- numeric(N)
  for (i in 1:N) {
    MET <- exp(rnorm(length(acts), log(MET0), SDL))  # v0.7: per-activity sdlog
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
             pRed = round(colMeans(sim$M >= A$band_edges[3]), 2),
             saturated = q[,2] >= A$M_cap,      # v0.7 P2: UI shows '>2.5x'
             typ_pct = typicality(sim))
}
if (nzchar(Sys.getenv("BODY_LIB"))) stop_here <- TRUE else stop_here <- FALSE

# =============================================================================
# 3. SCENARIOS (built from the ATUS mean day by swapping TV time; ASSUMED)
#    Every scenario is a user-input data.frame (the input contract above).
# =============================================================================
if (!stop_here) {
D <- function(a, m, e = NA, it = NA) data.frame(activity = a, minutes = m, exercise = e, intensity = it, stringsAsFactors = FALSE)
days <- list(sedentary = NULL, walk30 = D("walk_brisk", 30))
for (a in ex$activity_id) if (a != "walk_brisk") days[[paste0(a, "45")]] <- D(a, 45)
for (e in unique(lmet$exercise_id)) days[[paste0("lift_", e, "45")]] <- D("weightlifting", 45, e)  # default intensity
for (e in c("biceps_curl", "bench_press")) days[[paste0("lift_", e, "45_vig")]] <- D("weightlifting", 45, e, "vigorous")
days$tennis60_curl30 <- D(c("tennis", "weightlifting"), c(60, 30), c(NA, "biceps_curl"), c(NA, "vigorous"))

sink(file.path(here, "demo_output_v7.txt"), split = TRUE)
cat("Body model v0.7 —", format(Sys.time()), "\n")
cat(sprintf("Raw ATUS minutes %.1f rescaled to %.1f\n", raw_min_sum, sum(base$min)))
cat(sprintf("Deterministic baseline net = %.3f MET-h/day (researcher TOTAL_net %.2f)\n", sum(base$min * pmax(base$MET - 1, 0)) / 60, ref_net))
cat("Inputs: activation_shares_v2.1 + postural_shares_v1.1 + lift_shares/lift_mets (from lifts_v1.1), activity_catalog, baseline_row_map,\n  mets.csv + activities25_mets.csv, muscle_mass_8part_v1 (average), nonexerciser_baseline_v2 + atus_nonexercisers_v2 (IPUMS 18+)\n")
cat(sprintf("Share rule (ASSUMPTION): share = mass x activation, assumed indices x%g onto %%MVIC, every row\n", A$assumed_index_scale))
cat(sprintf("Activities: %d catalog + %d lifts x 3 intensities; lowN (<%d ATUS respondents) flagged: %s\n",
            nrow(ex), length(unique(lmet$exercise_id)), A$lowN, paste(lowN_ids, collapse = ", ")))
cat("Activity METs (code, median, sdlog):\n"); print(ex[, c("activity_id","row","code","MET","sdlog")], row.names = FALSE, digits = 3)
cat(sprintf("ASSUMPTIONS: kappa cited/stand-in/ASSUMPTION = %s; MET CV %.2f (sdlog %.3f) unless range given (range = 89%% interval); deff %.1f; phi %.2f; M_cap %g; N %d\n",
            paste(A$kappa, collapse = "/"), A$met_cv, met_sdlog, A$deff, A$phi, A$M_cap, A$N))
cat("\nColumns: median and 89% interval of M; band of the median; straddlesCutoff = interval spans >= 2 band edges;\nhighUncertainty = log2(hi/lo) > 2; offset_gt_B = share of draws F_p > B_p; pRed = P(M >= 1.8); saturated = median >= 2.5 (UI '>2.5x'); typ_pct = typicality percentile.\n")
cal <- simulate_day(NULL)$gross_ind
cat(sprintf("\nCalibration (individual days, gross MET-h/day): SD %.2f (cited 4.40); p10 %.2f (28.22); p50 %.2f (32.60); p90 %.2f (38.80)\n",
            sd(cal), quantile(cal, .1), quantile(cal, .5), quantile(cal, .9)))
cat(sprintf("Spec §10 test 1 (SD [3.90,4.40], p10 [27.6,28.4], p90 [37.6,38.8]): %s\n",
            ifelse(sd(cal) >= 3.9 && sd(cal) <= 4.4 && quantile(cal,.1) >= 27.6 && quantile(cal,.1) <= 28.4 &&
                   quantile(cal,.9) >= 37.6 && quantile(cal,.9) <= 38.8, "PASS", "FAIL")))
res <- list()
for (d in names(days)) {
  lab <- if (is.null(days[[d]])) "" else paste(sprintf("%s%s %g min%s", days[[d]]$activity,
           ifelse(is.na(days[[d]]$exercise), "", paste0(":", days[[d]]$exercise)), days[[d]]$minutes,
           ifelse(is.na(days[[d]]$intensity), "", paste0(" (", days[[d]]$intensity, ")"))), collapse = " + ")
  low <- any(days[[d]]$activity %in% lowN_ids)
  cat("\n=== Scenario:", d, lab, if (low) "[lowN: ATUS participation n < 10]" else "", "===\n")
  res[[d]] <- summarise(simulate_day(days[[d]]))
  print(res[[d]], row.names = FALSE)
}
# --- Required physiological sanity check (Body, 2026-10-24) -------------------
cat("\n=== Sanity check: multiples relative to each part's own baseline ===\n")
chk <- list(c("lift_hip_thrust45", "hips_glutes", "legs"), c("lift_bench_press45", "chest", "arms"),
            c("lift_bench_press45_vig", "chest", "arms"), c("lift_biceps_curl45", "arms", "legs"),
            c("lift_back_squat45", "legs", "arms"), c("swimming45", "shoulders", "hips_glutes"))
for (k in chk) { r <- res[[k[1]]]; a <- r$median[r$part == k[2]]; b <- r$median[r$part == k[3]]
  cat(sprintf("%-24s %s %.2f (%s) vs %s %.2f (%s): %s\n", k[1], k[2], a, band_of(a), k[3], b, band_of(b),
              ifelse(a >= b, "OK (expected part at least as hot)", "REVIEW"))) }
cat("\n=== Sensitivity: run45 medians by phi (ASSUMPTION) ===\n")
sens <- sapply(c(0.05, 0.25, 0.5), function(ph) {
  set.seed(2026); round(apply(simulate_day(days$jog45, phi = ph)$M, 2, median), 2) })
colnames(sens) <- paste0("phi=", c(0.05, 0.25, 0.5)); print(sens)
sink()
}
