# golden_criterion_v07.R — the TS-vs-R golden criterion (spec §10, v0.7) as code.
# check(ts, r): ts and r are per-cell tables (scenario, part, lo, med, hi, band,
# straddles, highU, saturated). Returns the failing rows (0 rows = PASS).
edges <- c(1.15, 1.4, 1.8); cap <- 2.5
check <- function(ts, r) {
  m <- merge(ts, r, by = c("scenario", "part"), suffixes = c("", ".r"))
  rel <- function(a, b) abs(a - b) / b
  dist <- function(v, th) sapply(v, function(x) min(abs(x - th) / th))
  f_med <- rel(m$med, m$med.r) > 0.06
  f_lo  <- rel(m$lo,  m$lo.r)  > 0.06
  f_hi  <- rel(m$hi,  m$hi.r)  > 0.30
  g_band <- dist(m$med.r, c(edges, cap)) > 0.03
  f_band <- g_band & (m$band != m$band.r | m$saturated != m$saturated.r)
  g_str  <- pmin(dist(m$lo.r, edges), dist(m$hi.r, edges)) > 0.10
  f_str  <- g_str & m$straddles != m$straddles.r
  g_hu   <- abs(log2(m$hi.r / m$lo.r) - 2) > 0.3
  f_hu   <- g_hu & m$highU != m$highU.r
  m$fail <- paste0(ifelse(f_med, "med ", ""), ifelse(f_lo, "lo ", ""), ifelse(f_hi, "hi ", ""),
                   ifelse(f_band, "band ", ""), ifelse(f_str, "straddles ", ""), ifelse(f_hu, "highU", ""))
  k <- m$med.r > 1.05                    # aggregate bias test (catches small systematic bugs)
  attr(m, "meanExcess") <- mean((m$med[k] - 1) / (m$med.r[k] - 1) - 1)
  if (abs(attr(m, "meanExcess")) > 0.02) m$fail[1] <- paste(m$fail[1], "AGGREGATE")
  attr(m, "coverage") <- c(band = mean(g_band), straddles = mean(g_str), highU = mean(g_hu))
  m
}
if (sys.nframe() == 0) {
  R <- readRDS("/workspace/body/tests/seeds/seed_2026.rds")
  for (p in list.files("/workspace/body/tests/seeds", "seed_\\d+\\.rds$", full.names = TRUE)) {
    if (grepl("/seed_2026", p)) next
    m <- check(readRDS(p), R); nf <- sum(nzchar(m$fail))
    tab <- table(unlist(strsplit(trimws(m$fail[nzchar(m$fail)]), " ")))
    cat(sprintf("%-22s meanExcess %+.4f failing cells %3d / %d  %s\n", basename(p), attr(m, "meanExcess"), nf, nrow(m),
                paste(names(tab), tab, sep = "=", collapse = " ")))
  }
  cat("guard coverage (share of cells where equality is required):\n"); print(round(attr(m, "coverage"), 3))
}
