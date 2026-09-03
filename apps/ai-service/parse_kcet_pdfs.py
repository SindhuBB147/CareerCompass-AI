import os
import re
import pypdf

# 1. Map 2025 course names to standard codes
COURSE_NAME_TO_CODE = {
    "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE": "AD",
    "ARTIFICIAL INTELLIGENCE": "AI",
    "ARTIFICIAL INTELLIGENCE & MACHINE LEARNING": "AI",
    "CIVIL ENGINEERING": "CE",
    "CIVIL": "CE",
    "COMPUTER SCIENCE AND ENGINEERING": "CS",
    "COMPUTER SCIENCE & ENGINEERING": "CS",
    "COMPUTER SCIENCE": "CS",
    "ELECTRICAL & ELECTRONICS ENGINEERING": "EE",
    "ELECTRICAL AND ELECTRONICS ENGINEERING": "EE",
    "ELECTRONICS AND COMMUNICATION ENGG": "EC",
    "ELECTRONICS AND COMMUNICATION ENGINEERING": "EC",
    "INFORMATION SCIENCE AND ENGINEERING": "IS",
    "INFORMATION SCIENCE & ENGINEERING": "IS",
    "MECHANICAL ENGINEERING": "ME",
    "MECHANICAL": "ME",
    "ELECTRONICS AND INSTRUMENTATION ENGINEERING": "EI",
    "ELECTRONICS AND TELECOMMUNICATION ENGINEERING": "ET",
    "INDUSTRIAL ENGINEERING & MANAGEMENT": "IM",
    "INDUSTRIAL ENGINEERING AND MANAGEMENT": "IM",
    "BIO TECHNOLOGY": "BT",
    "CHEMICAL ENGINEERING": "CH",
    "AERO SPACE ENGINEERING": "SE",
    "AEROSPACE ENGINEERING": "SE",
    "AERONAUTICAL ENGINEERING": "AE",
    "AUTOMOBILE ENGINEERING": "AU",
    "SILK TECHNOLOGY": "ST",
    "TEXTILE TECHNOLOGY": "TX",
    "MEDICAL ELECTRONICS": "MD",
    "CS (AI, MACHINE LEARNING)": "CA",
    "CS- CYBER SECURITY": "CY",
    "CS - CYBER SECURITY": "CY",
    "COMP. SC. AND BUS SYS.": "CB",
    "COMPUTER SC. AND DESIGN": "CD",
    "COMP. SC. ENGG- DATA SC.": "DS"
}

bounds = [
    (23, 30), (31, 37), (38, 44), (45, 52), (53, 59), (60, 67),
    (68, 74), (75, 82), (83, 89), (90, 97), (98, 104), (105, 112),
    (113, 119), (120, 127), (128, 135), (136, 142), (143, 149),
    (150, 157), (158, 164), (165, 172), (173, 179), (180, 187),
    (188, 194), (195, 205)
]

categories = [
    "1G", "1K", "1R", "2AG", "2AK", "2AR", "2BG", "2BK", "2BR", "3AG", "3AK", "3AR", "3BG", "3BK", "3BR", "GM", "GMK", "GMR", "SCG", "SCK", "SCR", "STG", "STK", "STR"
]

def split_run_together(token):
    if not token.isdigit() or len(token) <= 6:
        return [token]
    if len(token) % 6 == 0:
        return [token[i:i+6] for i in range(0, len(token), 6)]
    if len(token) % 5 == 0:
        return [token[i:i+5] for i in range(0, len(token), 5)]
    
    chunks = []
    i = 0
    while i < len(token):
        if len(token) - i >= 6 and token[i] != '0':
            chunks.append(token[i:i+6])
            i += 6
        elif len(token) - i >= 5:
            chunks.append(token[i:i+5])
            i += 5
        else:
            chunks.append(token[i:])
            break
    return chunks

def parse_2023_pdf(pdf_path, year, round_name, output_csv_path):
    print(f"Parsing 2023 PDF: {os.path.basename(pdf_path)} -> Round {round_name}")
    reader = pypdf.PdfReader(pdf_path)
    
    csv_rows = []
    header = "exam,year,round,counsellingAuthority,collegeCode,collegeName,courseCode,courseName,category,quota,openingRank,closingRank,state,collegeType,source"
    csv_rows.append(header)
    
    total_raw_rows = 0
    
    for page_idx, page in enumerate(reader.pages):
        text = page.extract_text(extraction_mode="layout")
        lines = text.split("\n")
        
        current_college_code = None
        current_college_name = None
        
        for line in lines:
            # check for college header e.g. "E001 University of..."
            m_college = re.search(r'\b(E\d{3})\b', line)
            # exclude lines starting with course codes to avoid mismatch
            if m_college and not any(line.strip().startswith(c) for c in ["AI", "CE", "CS", "EC", "EE", "IE", "ME", "BT", "CH", "CY", "DS", "EI", "ET", "AD", "CB", "CD", "SE", "MD"]):
                current_college_code = m_college.group(1)
                parts = line.split(current_college_code)
                current_college_name = parts[1].strip() if len(parts) > 1 else ""
                # Clean up name if it has trailing numbers or notes
                current_college_name = re.sub(r'\s*\(\s*PUBLIC UNIV\.\s*\)\s*', '', current_college_name)
                current_college_name = re.sub(r'\s*\(\s*AUTONOMOUS\s*\)\s*', '', current_college_name)
                continue
            
            stripped = line.strip()
            if not stripped:
                continue
            
            first_word = stripped.split()[0]
            # Match course code
            if len(first_word) == 2 and first_word.isupper() and any(c in line for c in ["--", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]):
                if not current_college_code:
                    continue
                
                course_code = first_word
                # Extract course name: text between code and start of ranks (around index 23)
                course_name = line[line.find(course_code)+2:23].strip()
                
                # Extract ranks part
                ranks_part = line[20:].strip()
                raw_tokens = ranks_part.split()
                
                processed_tokens = []
                for t in raw_tokens:
                    processed_tokens.extend(split_run_together(t))
                
                # Skip header rows that match criteria but contain GM / GMK text
                if "GM" in processed_tokens and "STR" in processed_tokens:
                    continue
                
                if len(processed_tokens) != 24:
                    # If layout mismatch, skip or pad, but let's log it
                    # print(f"Warning: expected 24 rank values, got {len(processed_tokens)} for {current_college_code}-{course_code}")
                    continue
                
                total_raw_rows += 1
                for idx, cat in enumerate(categories):
                    val = processed_tokens[idx]
                    if val == "--" or not val.strip():
                        continue
                    
                    # Determine quota
                    quota = "General"
                    if cat.endswith("R"):
                        quota = "Rural"
                    elif cat.endswith("K"):
                        quota = "Kannada Medium"
                        
                    closing_rank = val.replace(".", "").strip() # remove any fractional dot
                    
                    csv_rows.append(f'KCET,{year},{round_name},KEA,{current_college_code},"{current_college_name}",{course_code},"{course_name}",{cat},{quota},,{closing_rank},Karnataka,Private,{os.path.basename(pdf_path)}')
                    
    with open(output_csv_path, "w", encoding="utf-8") as f:
        f.write("\n".join(csv_rows))
        
    print(f"Extracted {total_raw_rows} course rank rows, outputted to {output_csv_path}")
    return total_raw_rows

def parse_2025_pdf(pdf_path, year, round_name, output_csv_path):
    print(f"Parsing 2025 PDF: {os.path.basename(pdf_path)} -> Round {round_name}")
    reader = pypdf.PdfReader(pdf_path)
    
    csv_rows = []
    header = "exam,year,round,counsellingAuthority,collegeCode,collegeName,courseCode,courseName,category,quota,openingRank,closingRank,state,collegeType,source"
    csv_rows.append(header)
    
    total_raw_rows = 0
    
    current_college_code = None
    current_college_name = None
    current_course_name_lines = []
    
    for page_idx, page in enumerate(reader.pages):
        text = page.extract_text()
        lines = text.split("\n")
        
        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue
                
            # check for college header e.g. "College: (E001)Univesity of..."
            if line_str.startswith("College:"):
                # Parse college code and name
                m = re.search(r'\((E\d{3})\)\s*(.*)', line_str)
                if m:
                    current_college_code = m.group(1)
                    current_college_name = m.group(2).strip()
                    current_college_name = re.sub(r'\(\s*AUTONOMOUS\s*\)\s*', '', current_college_name, flags=re.IGNORECASE)
                current_course_name_lines = []
                continue
                
            if line_str.startswith("Course Name") or line_str.startswith("Non-Interactive") or line_str.startswith("UGCET-2025") or line_str.startswith("Seat Type:"):
                continue
                
            if "KARNATAKA EXAMINATIONS AUTHORITY" in line_str:
                continue
                
            # check for rank line: starts with numbers, e.g. "7516 -- -- 6634"
            # It should have multiple numbers or --
            tokens = line_str.split()
            is_rank_line = len(tokens) >= 10 and any(t.isdigit() or t == "--" for t in tokens)
            
            if is_rank_line:
                if not current_college_code or not current_course_name_lines:
                    continue
                    
                full_course_name = " ".join(current_course_name_lines).strip()
                # Map course name to code
                course_code = "UN"
                for name, code in COURSE_NAME_TO_CODE.items():
                    if name in full_course_name.upper():
                        course_code = code
                        break
                        
                # Split tokens
                processed_tokens = []
                for t in tokens:
                    processed_tokens.extend(split_run_together(t))
                    
                if len(processed_tokens) != 24:
                    # print(f"Warning: Expected 24 rank values, got {len(processed_tokens)} for {current_college_code} - {full_course_name}")
                    current_course_name_lines = []
                    continue
                    
                total_raw_rows += 1
                for idx, cat in enumerate(categories):
                    val = processed_tokens[idx]
                    if val == "--" or not val.strip():
                        continue
                        
                    quota = "General"
                    if cat.endswith("R"):
                        quota = "Rural"
                    elif cat.endswith("K"):
                        quota = "Kannada Medium"
                        
                    closing_rank = val.split('.')[0].strip() # parse decimal ranks e.g. 76553.5
                    
                    csv_rows.append(f'KCET,{year},{round_name},KEA,{current_college_code},"{current_college_name}",{course_code},"{full_course_name}",{cat},{quota},,{closing_rank},Karnataka,Private,{os.path.basename(pdf_path)}')
                    
                current_course_name_lines = []
            else:
                # Accumulate course name lines
                # Course names are alphabetic (e.g. "CIVIL", "COMPUTER SCIENCE")
                if current_college_code and not line_str.startswith("College:"):
                    current_course_name_lines.append(line_str)
                    
    with open(output_csv_path, "w", encoding="utf-8") as f:
        f.write("\n".join(csv_rows))
        
    print(f"Extracted {total_raw_rows} course rank rows, outputted to {output_csv_path}")
    return total_raw_rows

def main():
    raw_dir = "C:/Users/sindh/Downloads/career-compass-ai/files/kcet/raw"
    
    # 2023 Round 1
    pdf_r1 = os.path.join(raw_dir, "KCET_ENG_CUTOFF_2023_GENenglish.pdf")
    csv_r1 = os.path.join(raw_dir, "kcet_2023_r1.csv")
    parse_2023_pdf(pdf_r1, 2023, 1, csv_r1)
    
    # 2023 Round 2
    pdf_r2 = os.path.join(raw_dir, "KCET_ENGG_CUTOFF_2023_R2english.pdf")
    csv_r2 = os.path.join(raw_dir, "kcet_2023_r2.csv")
    parse_2023_pdf(pdf_r2, 2023, 2, csv_r2)
    
    # 2023 Second Extended (Round 3)
    pdf_r3 = os.path.join(raw_dir, "KCET_ENR2_CUTGENenglish.pdf")
    csv_r3 = os.path.join(raw_dir, "kcet_2023_r3.csv")
    parse_2023_pdf(pdf_r3, 2023, 3, csv_r3)
    
    # 2025 Round 1
    pdf_2025_r1 = os.path.join(raw_dir, "KCET_provisional-round-1-cutoff.pdf")
    csv_2025_r1 = os.path.join(raw_dir, "kcet_2025_r1.csv")
    parse_2025_pdf(pdf_2025_r1, 2025, 1, csv_2025_r1)

if __name__ == "__main__":
    main()
