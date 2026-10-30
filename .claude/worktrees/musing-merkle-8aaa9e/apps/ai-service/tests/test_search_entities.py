from rag.search_entities import extract_entities


def test_budget_extraction_with_lakh_unit():
    e = extract_entities("Best CSE colleges under ₹2 lakh")
    assert e.discipline == "Engineering"
    assert e.budget_max == 200_000
    assert e.sort_hint is None  # "best" alone (no placement/roi/nirf focus) isn't enough to infer a sort


def test_government_engineering_colleges_in_city():
    e = extract_entities("Government engineering colleges in Bangalore")
    assert e.college_type == "Government"
    assert e.discipline == "Engineering"
    assert e.city == "Bengaluru"


def test_neet_rank_without_a_number_uses_profile_rank():
    e = extract_entities("Medical colleges accepting my NEET rank")
    assert e.exam == "NEET"
    assert e.discipline == "Medical"
    assert e.rank is None
    assert e.use_profile_rank is True


def test_hostel_keyword_detected():
    e = extract_entities("Top colleges with hostel")
    assert e.hostel_required is True


def test_private_colleges_with_placement_focus():
    e = extract_entities("Private colleges with good placements")
    assert e.college_type == "Private"
    assert e.placement_focus is True


def test_roi_focus_sets_sort_hint():
    e = extract_entities("Best ROI colleges")
    assert e.roi_focus is True
    assert e.sort_hint == "roi"


def test_scholarship_for_category():
    e = extract_entities("Scholarships for SC students")
    assert e.scholarship_focus is True
    assert e.category == "SC"


def test_discipline_alias_ai_ml():
    e = extract_entities("Colleges with AI & ML")
    assert e.discipline == "Engineering"


def test_discipline_electronics():
    e = extract_entities("Top colleges for Electronics")
    assert e.discipline == "Engineering"


def test_exam_rank_threshold_explicit_number():
    e = extract_entities("Engineering colleges below KCET rank 20000")
    assert e.exam == "KCET"
    assert e.discipline == "Engineering"
    assert e.rank == 20000
    assert e.use_profile_rank is False


def test_neet_rank_threshold_explicit_number():
    e = extract_entities("Medical colleges below NEET rank 12000")
    assert e.exam == "NEET"
    assert e.discipline == "Medical"
    assert e.rank == 12000


def test_affordable_near_city_sets_fees_sort_hint():
    e = extract_entities("Affordable colleges near Mysore")
    assert e.city == "Mysuru"
    assert e.sort_hint == "fees"


def test_highest_average_package_is_placement_focus():
    e = extract_entities("Colleges with highest average package")
    assert e.placement_focus is True


def test_robotics_maps_to_engineering_discipline():
    # "Robotics" is a specialization within Engineering, not a distinct
    # COURSE_DISCIPLINES value, so it should widen to the Engineering
    # discipline filter (the course-name text itself carries the specificity).
    e = extract_entities("Best colleges for Robotics")
    assert e.discipline == "Engineering"


def test_hostel_and_transport_query():
    e = extract_entities("Which colleges have hostel and transport?")
    assert e.hostel_required is True


def test_nirf_rank_below_threshold_does_not_populate_generic_rank():
    e = extract_entities("Show colleges with NIRF rank below 50")
    assert e.nirf_max == 50
    assert e.rank is None
    assert e.use_profile_rank is False


def test_scholarship_eligibility_phrasing():
    e = extract_entities("Which scholarship can I apply?")
    assert e.scholarship_focus is True


def test_compare_two_known_colleges():
    e = extract_entities("Compare RVCE and BMSCE")
    assert e.action == "compare"
    assert "RV College of Engineering" in e.college_names
    assert "BMS College of Engineering" in e.college_names


def test_compare_does_not_pick_up_exam_or_short_acronyms():
    e = extract_entities("Compare KCET and COMEDK colleges for CSE")
    assert e.action == "compare"
    assert "KCET" not in e.college_names
    assert "COMEDK" not in e.college_names


def test_placements_focus_query():
    e = extract_entities("Best colleges for placements")
    assert e.placement_focus is True


def test_bare_rank_below_without_exam_or_nirf_defaults_to_exam_rank_reading():
    # Ambiguous per the disambiguation rule: no "nirf" qualifier present, so a
    # bare "rank below N" is treated as an exam-rank threshold, not NIRF.
    e = extract_entities("Show colleges with rank below 5000")
    assert e.rank == 5000
    assert e.nirf_max is None


def test_no_entities_extracted_from_pure_free_text():
    e = extract_entities("colleges that changed my life")
    assert e.exam is None
    assert e.discipline is None
    assert e.budget_max is None
    assert e.nirf_max is None
    assert e.rank is None
