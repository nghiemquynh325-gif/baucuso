
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import fs from 'fs';

const SUPABASE_URL = 'https://wimauldqyotovflfowjw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9Mn89B57Bd8-CGY59sluIQ_SWhWmelE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Master Data Mapping (Mini version)
const LOCATIONS = [
    { id: 'kv01', neighborhoodId: 'kp_1a', parentId: 'unit_1' },
    { id: 'kv02', neighborhoodId: 'kp_1a', parentId: 'unit_1' },
    { id: 'kv03', neighborhoodId: 'kp_1a', parentId: 'unit_1' },
    { id: 'kv04', neighborhoodId: 'kp_1a', parentId: 'unit_1' },
    { id: 'kv05', neighborhoodId: 'kp_1a', parentId: 'unit_1' },
    { id: 'kv06', neighborhoodId: 'kp_4', parentId: 'unit_1' },
    { id: 'kv07', neighborhoodId: 'kp_1b', parentId: 'unit_2' },
    { id: 'kv16', neighborhoodId: 'kp_2', parentId: 'unit_4' },
    { id: 'kv19', neighborhoodId: 'kp_3', parentId: 'unit_4' },
    { id: 'kv21', neighborhoodId: 'kp_3', parentId: 'unit_4' },
    // Add more as needed or use defaults
];

function getMapping(areaId) {
    const normalized = areaId.toLowerCase().replace(/\s+/g, '');
    const found = LOCATIONS.find(l => l.id === normalized);
    return {
        neighborhood_id: found?.neighborhoodId || 'kp_1a',
        unit_id: found?.parentId || 'unit_1'
    };
}

async function importExcel(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    console.log(`Reading file: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const datasheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(datasheet, { header: 1 });

    let currentAreaId = 'kv01';
    const voters = [];

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const rowText = row.join(' ');

        // Detect Area from header
        const areaMatch = rowText.match(/Khu vực bỏ phiếu số:\s*(\d+)/i);
        if (areaMatch) {
            currentAreaId = `kv${areaMatch[1].padStart(2, '0')}`;
            console.log(`>>> Detected Area in header: ${currentAreaId}`);
            continue;
        }

        // Skip header rows (detect by STT column)
        const stt = String(row[0] || '').trim();
        if (!stt || !stt.match(/^\d+$/)) continue;

        // Column Mapping (Based on verified diagnostic):
        // 0: STT | 1: Số thẻ | 2: Họ tên | 3: Ngày sinh | 4: Nam | 5: Nữ | 6: CCCD | 7: Dân tộc 
        // 8: Thường trú | 9: Tạm trú | 10: Nơi ở hiện tại | 11: QH | 12: Tỉnh | 13: Xã | 14: Ghi chú

        const diagStr = `ROW ${i}: ${row.map((v, idx) => `[${idx}]: ${v}`).join(' | ')}\n`;
        fs.appendFileSync('diag_voters.txt', diagStr);

        const name = String(row[2] || '').trim().toUpperCase();
        if (!name || name === 'HỌ VÀ TÊN' || name === '(1)') continue;

        const voterCardNo = String(row[1] || row[0] || '').trim();
        const dob = String(row[3] || '').trim();
        const isFemale = (String(row[5] || '').toLowerCase() === 'x' || String(row[5] || '').toLowerCase().includes('nữ'));
        const gender = isFemale ? 'Nữ' : 'Nam';
        const cccd = String(row[6] || '').trim() || `MISSING_${Date.now()}_${i}`;
        const ethnic = String(row[7] || '').trim() || 'Kinh';

        const permanentAddress = String(row[8] || '').trim();
        const temporaryAddress = (String(row[9] || '') || String(row[10] || '')).trim();
        const address = temporaryAddress || permanentAddress || 'CHƯA XÁC ĐỊNH';
        const resStatus = temporaryAddress ? 'tam-tru' : 'thuong-tru';

        let areaId = currentAreaId;

        const vQH = String(row[11] || '').toLowerCase() !== 'o';
        const vT = String(row[12] || '').toLowerCase() !== 'o';
        const vP = String(row[13] || '').toLowerCase() !== 'o';

        // Extract Group (Tổ) from address
        let groupName = 'Tổ --';
        const groupMatch = address.match(/Tổ\s*(\d+)/i);
        if (groupMatch) groupName = `Tổ ${groupMatch[1]}`;

        const mapping = getMapping(areaId);

        voters.push({
            name,
            dob,
            gender,
            cccd,
            ethnic,
            voter_card_number: voterCardNo,
            address: address.toUpperCase(),
            group_name: groupName,
            neighborhood_id: mapping.neighborhood_id,
            unit_id: mapping.unit_id,
            area_id: areaId,
            voting_status: 'chua-bau',
            residence_status: resStatus,
            vote_qh: vQH,
            vote_t: vT,
            vote_p: vP,
            permanent_address: permanentAddress.toUpperCase(),
            temporary_address: temporaryAddress.toUpperCase()
        });
    }

    console.log(`Parsed ${voters.length} voters.`);

    if (voters.length === 0) {
        console.log("No voters detected to import.");
        return;
    }

    // Batch insertion
    const BATCH_SIZE = 50;
    for (let i = 0; i < voters.length; i += BATCH_SIZE) {
        const batch = voters.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('voters').insert(batch);
        if (error) {
            console.error(`Error in batch ${i}:`, error.message);
        } else {
            console.log(`OK: Inserted ${i + 1} to ${Math.min(i + BATCH_SIZE, voters.length)}`);
        }
    }
    console.log("Import process finished.");
}

const filePath = process.argv[2];
if (!filePath) {
    console.log("Usage: node import_voters.js <path_to_excel>");
} else {
    importExcel(filePath).catch(err => console.error(err));
}
