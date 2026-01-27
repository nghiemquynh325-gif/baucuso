
import os

file_path = 'pages/CandidateList.tsx'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Test the repair on a snippet
    # "NGUYá»„N" -> encode('cp1252') -> decode('utf-8') should be "NGUYỄN"
    
    # Try one fix strategy:
    # 1. Encode to cp1252 (reverts the double-decode)
    # 2. Decode as utf-8 (interprets bytes correctly)
    
    fixed_content = content.encode('cp1252').decode('utf-8')
    
    print("Repair successful! Snippet:")
    print(fixed_content[:200])
    
    # If successful, write back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
        
except Exception as e:
    print(f"Error repairing file: {e}")
    # Fallback/Debug info
    try:
        snippet = content[:100]
        print(f"Current content snippet: {snippet}")
        print(f"Encoded CP1252: {snippet.encode('cp1252')}")
    except:
        pass
