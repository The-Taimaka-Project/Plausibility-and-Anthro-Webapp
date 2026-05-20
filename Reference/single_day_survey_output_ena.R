library(ruODK)
library(dplyr)
library(tidyr)

setwd("~/Taimaka/Data/rapid_muac")

central_base <- "https://your-odk-server.example.org"  # set to your ODK Central base URL

ru_setup(
  url = central_base,          # <-- base URL ONLY
  un   = "",
  pw   = "",# ideally a Personal Access Token from Central
  pid = 14,                    # your project ID
  odkc_version = "2024.2.1",     # or a literal like "2025.1.0" if you know it
  verbose = FALSE
)

forms <- form_list()

submissions <- submission_export(
  pid = 14,
  fid = "rapid_muac_survey",
  local_dir = ".",
  repeats = TRUE,   # ensures repeat groups are included
  media = FALSE     # set TRUE if you want to pull attachments/photos too
)

unzip("rapid_muac_survey.zip", exdir = "odk_data")

parent  <- readr::read_csv("odk_data/rapid_muac_survey.csv")
members <- readr::read_csv("odk_data/rapid_muac_survey-members.csv")

combined <- members %>%
  dplyr::left_join(parent, by = c("PARENT_KEY" = "KEY"))

library(dplyr)
library(stringr)
library(readr)


final <- combined %>%
  filter(child_name != "1000", survey_date == "2026-01-21") %>%
  mutate(
    # Convert to numeric, then pad with leading zero and add "p"
    pair = paste0("p", sprintf("%02d", as.integer(str_remove(pair, "pair")))),
    
    # Sequential child ID within household
    id = ave(rep(1, n()), hh_id, FUN = seq_along),
    
    # Convert MUAC cm to mm
    muac_mm = `age_6_59-muac` * 10
  ) %>%
  transmute(
    survey_date,
    cluster,
    pair,
    id,
    hh_id,
    sex       = c_sex,
    birthdate = birthdate,
    age       = age,
    blank1 = "",
    blank2 = "",
    blank3 = "",
    muac    = muac_mm
  ) %>%
  arrange(survey_date, cluster, pair, hh_id, id) 

write_csv(final, "rapid_muac_survey_cleaned.csv", na = "")

library(dplyr)
library(lubridate)

today_date <- "2026-01-21"

today_data <- final %>%
  filter(as.Date(survey_date) == today_date)

# 1. Overall percentage
overall_pct <- today_data %>%
  summarise(
    total_kids = n(),
    with_birthdate = sum(!is.na(birthdate)),
    pct_with_birthdate = round(with_birthdate / total_kids * 100, 1)
  )

print("Overall % with birthdate collected today:")
print(overall_pct)

# 2. By pair
by_pair_pct <- today_data %>%
  group_by(pair) %>%
  summarise(
    total_kids = n(),
    with_birthdate = sum(!is.na(birthdate)),
    pct_with_birthdate = round(with_birthdate / total_kids * 100, 1),
    .groups = "drop"
  )

print("By pair % with birthdate collected today:")
print(by_pair_pct)

birthdate_summary <- today_data %>%
  summarise(
    total_kids = n(),
    with_birthdate = sum(!is.na(birthdate)),
    pct_with_birthdate = round(with_birthdate / total_kids * 100, 1)
  )

print(birthdate_summary)