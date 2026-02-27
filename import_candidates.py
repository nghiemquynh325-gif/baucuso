import pandas as pd
import json
import urllib.request
import datetime

# Configuration
EXCEL_FILE = r'C:\Users\Admin\Downloads\DSDBCAPPHUONGCHINHTHUC.xlsx'
SUPABASE_URL = 'https://wimauldqyotovflfowjw.supabase.co'
SUPABASE_KEY = 'sb_publishable_9Mn89B57Bd8-CGY59sluIQ_SWhWmelE'

def format_date(val):
    if pd.isna(val):
        return None
    if isinstance(val, (datetime.datetime, pd.Timestamp)):
        return val.strftime('%Y-%m-%d')
    try:
        # Try to parse string date if it's not already a date object
        return str(val).split(' ')[0]
    except:
        return str(val)

def delete_existing_phuong_candidates():
    print("Cleaning up existing ward-level candidates...")
    url = f"{SUPABASE_URL}/rest/v1/candidates?level=eq.phuong"
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json'
    }
    req = urllib.request.Request(url, headers=headers, method='DELETE')
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Cleanup status: {response.getcode()}")
    except Exception as e:
        print(f"Cleanup error: {e}")

def import_candidates():
    # 1. Cleanup
    delete_existing_phuong_candidates()

    # 2. Extract and Upload
    xl = pd.ExcelFile(EXCEL_FILE)
    sheets = [s for s in xl.sheet_names if "Tổ" in s]
    print(f"Detected sheets for units: {sheets}")

    all_candidates = []

    for sheet in sheets:
        print(f"Processing {sheet}...")
        # Get unit_id from sheet name (e.g., "Tổ 1" -> "unit_1")
        unit_num = sheet.split(" ")[-1]
        unit_id = f"unit_{unit_num}"
        
        # Read sheet
        df = pd.read_excel(xl, sheet_name=sheet, header=None)
        
        # Data starts from row 12 (index 12)
        for i in range(12, len(df)):
            row = df.iloc[i]
            
            # STT is at index 0
            if pd.isna(row[0]) or str(row[0]).strip() == "":
                continue
            
            try:
                candidate = {
                    "name": str(row[1]).strip().upper(),
                    "level": "phuong",
                    "unit_id": unit_id,
                    "dob": format_date(row[2]),
                    "gender": str(row[3]).strip(),
                    "title": str(row[10]).strip() if not pd.isna(row[10]) else "",
                    "hometown": str(row[7]).strip() if not pd.isna(row[7]) else ""
                }
                
                # Basic validation
                if not candidate["name"] or candidate["name"] == "NAN" or len(candidate["name"]) < 2:
                    continue
                    
                all_candidates.append(candidate)
                print(f"  Mapped: {candidate['name']} ({unit_id})")
            except Exception as e:
                print(f"  Error mapping row {i} in {sheet}: {e}")

    print(f"Total candidates mapped: {len(all_candidates)}")
    
    if not all_candidates:
        print("No candidates found to import.")
        return

    # Upload in chunks of 50
    chunk_size = 50
    for i in range(0, len(all_candidates), chunk_size):
        chunk = all_candidates[i:i + chunk_size]
        payload = json.dumps(chunk).encode('utf-8')
        
        url = f"{SUPABASE_URL}/rest/v1/candidates"
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json'
        }
        
        req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
        
        try:
            with urllib.request.urlopen(req) as response:
                status = response.getcode()
                print(f"Chunk {i//chunk_size + 1}: Status {status}")
        except Exception as e:
            print(f"Error uploading chunk {i//chunk_size + 1}: {e}")
            if hasattr(e, 'read'):
                print(f"  Detail: {e.read().decode()}")

if __name__ == "__main__":
    import_candidates()
