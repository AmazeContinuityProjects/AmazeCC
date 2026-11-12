# Cab Share — Known Issues

1. Matching is pickup/drop _string_ matching — normalization is borrowed from VTOP stop names; edge cases report as "not found".
2. Stale cached trips from cancelled posters can ghost in results — cancelled trips are marked and filtered on next fetch.
