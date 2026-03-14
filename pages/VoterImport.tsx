import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AN_PHU_LOCATIONS } from '../types';
import { createLog } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

interface VoterImportProps {
  onBack: () => void;
  isLargeText?: boolean;
}

interface ParsedVoter {
  name: string;
  dob: string;
  gender: string;
  cccd: string;
  ethnic: string;
  voter_card_number: string;
  address: string;
  group_name: string;
  neighborhood_id: string;
  unit_id: string;
  area_id: string;
  voting_status: string;
  residence_status: string;
  permanent_address?: string;
  temporary_address?: string;
  vote_qh: boolean;
  vote_t: boolean;
  vote_p: boolean;
}

interface FailedRecord {
  lineIndex: number;
  rawContent: string;
  reason: string;
  suggestion: string;
  canForceAdd?: boolean;
  parsedData?: ParsedVoter;
}

interface ImportResult {
  totalProcessed: number;
  successCount: number;
  skippedCount: number;
  failedRecords: FailedRecord[];
}

export const VoterImport: React.FC<VoterImportProps> = ({ onBack, isLargeText }) => {
  const { profile } = useAuth();
  const { showNotification, showConfirm } = useNotification();
  const [rawData, setRawData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importLogs, setImportLogs] = useState<{ msg: string, type: 'info' | 'error' | 'success' }[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setImportLogs(prev => [{ msg, type }, ...prev].slice(0, 100));
  };

  // CHUẨN HÓA: Truy xuất Đơn vị từ bộ Master Data dựa trên KVBP
  const getUnitIdFromAreaId = (areaId: string): string => {
    // Normalize areaId for lookup (e.g., "KV 22" -> "kv22")
    const normalized = areaId.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    const found = AN_PHU_LOCATIONS.find(l => l.id.toLowerCase() === normalized);
    return found?.parentId || 'unit_1';
  };

  // CHUẨN HÓA: Truy xuất Khu phố từ bộ Master Data
  const getNeighborhoodIdFromAreaId = (areaId: string): string => {
    const normalized = areaId.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    const found = AN_PHU_LOCATIONS.find(l => l.id.toLowerCase() === normalized);
    return found?.neighborhoodId || 'kp_1a'; // Mặc định kp_1a
  };

  const handleClearData = async () => {
    showConfirm('CẢNH BÁO: Xóa toàn bộ dữ liệu cử tri hiện tại?', {
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const { error } = await supabase.from('voters').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (error) throw error;
          addLog('Hệ thống đã được làm sạch hoàn toàn.', 'success');
          setResult(null);

          // LOGGING
          createLog({
            userName: profile?.fullName || profile?.role,
            action: 'LÀM SẠCH HỆ THỐNG',
            details: 'Đã xóa toàn bộ dữ liệu cử tri',
            status: 'success'
          });
        } catch (err: any) {
          addLog('Lỗi xóa: ' + err.message, 'error');
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  // Hàm xử lý riêng cho việc thêm bản ghi bị lỗi (Force Add)
  const handleForceAdd = async (record: FailedRecord) => {
    if (!record.parsedData) return;

    try {
      const { error } = await supabase.from('voters').insert([record.parsedData]);
      if (error) throw error;

      // Cập nhật lại UI sau khi thêm thành công
      setResult(prev => {
        if (!prev) return null;
        return {
          ...prev,
          successCount: prev.successCount + 1,
          failedRecords: prev.failedRecords.filter(r => r.lineIndex !== record.lineIndex)
        };
      });
      addLog(`Đã thêm thủ công cử tri: ${record.parsedData.name}`, 'success');
    } catch (err: any) {
      showNotification('Lỗi khi thêm: ' + err.message);
    }
  };

  const handleImport = async () => {
    if (!rawData.trim()) return;
    setIsProcessing(true);
    setResult(null);
    setImportLogs([]);
    addLog('Bắt đầu quy trình bóc tách dữ liệu chuẩn hóa (v2.0 - Insert Mode)...', 'info');

    try {
      const lines = rawData.trim().split('\n');
      const votersList: ParsedVoter[] = [];
      const failedList: FailedRecord[] = [];
      let processedCount = 0;
      let skippedCount = 0;

      let currentDetectedAreaId = 'kv01'; // Default

      // MỚI: KẾT HỢP CÁC DÒNG BỊ NGẮT (Hỗ trợ copy từ PDF hoặc các bảng bị wrap)
      const combinedLines: string[] = [];
      let currentBuffer = "";
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Header Khu vực (Chỉ nhận diện nếu là dòng riêng biệt hoặc bắt đầu bằng tiền tố chuẩn)
        const isAreaHeader = trimmed.match(/^\s*(?:Khu vực|KVBP|KV)\s*(?:bỏ phiếu\s*)?(?:số\s*)?[:\s]*(\d+)\s*$/i);
        // Dòng dữ liệu mới thường bắt đầu bằng STT (Số)
        const isNewRecord = /^\d+/.test(trimmed);

        if (isAreaHeader) {
          if (currentBuffer) combinedLines.push(currentBuffer);
          combinedLines.push(trimmed);
          currentBuffer = "";
        } else if (isNewRecord) {
          if (currentBuffer) combinedLines.push(currentBuffer);
          currentBuffer = trimmed;
        } else {
          if (currentBuffer) {
            currentBuffer += " " + trimmed;
          } else {
            combinedLines.push(trimmed);
          }
        }
      });
      if (currentBuffer) combinedLines.push(currentBuffer);

      combinedLines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        // --- NHẬN DIỆN DIỆN KHU VỰC BỎ PHIẾU TỪ TIÊU ĐỀ (Strict hơn) ---
        const areaHeaderMatch = trimmedLine.match(/^\s*(?:Khu vực|KV|KVBP)\s*(?:bỏ phiếu\s*)?(?:số\s*)?[:\s]*(\d+)\s*$/i);
        if (areaHeaderMatch) {
          const num = areaHeaderMatch[1].padStart(2, '0');
          currentDetectedAreaId = `kv${num}`;
          addLog(`>>> PHÁT HIỆN KHU VỰC: ${num} (ID: ${currentDetectedAreaId})`, 'info');
          return;
        }

        // Skip header lines likely containing keywords
        if (
          trimmedLine.includes('DANH SÁCH CỬ TRI') ||
          (trimmedLine.includes('Họ và tên') && trimmedLine.includes('Ngày sinh')) ||
          trimmedLine.includes('Tổng số') ||
          trimmedLine.includes('Người lập biểu') ||
          trimmedLine.includes('Danh sách này được lập') ||
          trimmedLine.includes('Cử tri tham gia bầu cử') ||
          trimmedLine.match(/^\(\d+\)\s*$/) // Skip lines like (1), (2)... nếu nó đứng một mình
        ) {
          return;
        }

        processedCount++;

        // --- BÓC TÁCH DỮ LIỆU ---

        // KIỂM TRA ĐỊNH DẠNG TAB (COPY TỪ EXCEL)
        if (trimmedLine.includes('\t')) {
          const cols = trimmedLine.split('\t').map(c => c.trim());
          if (cols.length >= 7) {
            // Cấu trúc chuẩn từ file Excel KVBP19 (15 cột):
            // 0: Số thẻ (STT) | 1: Họ tên | 2: Ngày sinh | 3: Nam | 4: Nữ | 5: CCCD | 6: Dân tộc
            // 7: Thường trú | 8: Tạm trú | 9: Nơi ở hiện tại | 10: KVBP
            // 11: Bầu QH | 12: Bầu TP | 13: Bầu P | 14: Ghi chú

            const voterCardNo = cols[0]; // Số thẻ cử tri = STT
            const name = (cols[1] || '').toUpperCase();
            const dob = cols[2] || '';
            const isFemale = (cols[4] && cols[4].toLowerCase() === 'x');
            const gender = isFemale ? 'Nữ' : 'Nam';
            const cccd = cols[5] || `MISSING_${Date.now()}_${index}`;
            const ethnic = cols[6] || 'Kinh';

            const permanentAddress = cols[7] || '';
            const temporaryAddress = cols[8] || '';
            const currentAddress = cols[9] || '';
            const address = temporaryAddress || currentAddress || permanentAddress || 'CHƯA XÁC ĐỊNH';
            const residenceStatus = temporaryAddress ? 'tam-tru' : 'thuong-tru';

            // KVBP từ cột 10
            let rowAreaId = currentDetectedAreaId;
            if (cols[10] && /KV\s*\d+/i.test(cols[10])) {
              rowAreaId = cols[10].toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
            }

            // Quyền bầu cử: cột 11 (QH), 12 (TP), 13 (P)
            const isYes = (val: string | undefined) => {
              if (!val) return false;
              const v = val.toLowerCase().trim();
              return v === 'x';
            };

            const vQH = isYes(cols[11]);
            const vT = isYes(cols[12]);
            const vP = isYes(cols[13]);

            if (index < 10) {
              addLog(`LOG: Dòng ${index + 1}: ${name} | KV: ${rowAreaId} | QH:[${cols[11] || ''}] TP:[${cols[12] || ''}] P:[${cols[13] || ''}]`, 'info');
              addLog(`--> Kết quả: QH=${vQH}, TP=${vT}, P=${vP}`, 'info');
            }

            // Trích xuất Tổ từ địa chỉ
            let groupName = 'Tổ --';
            const groupMatch = address.match(/Tổ\s*(\d+)/i);
            if (groupMatch) groupName = `Tổ ${groupMatch[1]}`;

            votersList.push({
              name, dob, gender, cccd, ethnic,
              voter_card_number: voterCardNo,
              address: address.toUpperCase(),
              group_name: groupName,
              neighborhood_id: getNeighborhoodIdFromAreaId(rowAreaId),
              unit_id: getUnitIdFromAreaId(rowAreaId),
              area_id: rowAreaId,
              voting_status: 'chua-bau',
              residence_status: residenceStatus,
              permanent_address: permanentAddress.toUpperCase(),
              temporary_address: temporaryAddress.toUpperCase(),
              vote_qh: vQH,
              vote_t: vT,
              vote_p: vP
            });
            return;
          }
        }

        // FALLBACK: REGEX CHO DỮ LIỆU THÔ KHÔNG TAB
        const cccdMatch = trimmedLine.match(/\b\d{9,12}\b/);

        if (!cccdMatch) {
          // Check if this looks like a data row (len > 20 and not matching known junk keywords)
          // Since we already filter header lines at the top, a non-empty line without CCCD is suspicious
          if (trimmedLine.length > 20) {
            // Generate placeholder data to allow Force Import
            const placeholderCccd = `MISSING_${Date.now()}_${index}`;
            const placeholderName = trimmedLine.replace(/^[\d\.\s]+/, '').substring(0, 50).trim() || 'CHƯA XÁC ĐỊNH';

            // Construct a temporary ParsedVoter object using defaults
            const defaultAreaId = 'kv01';
            const tempVoter: ParsedVoter = {
              name: placeholderName,
              dob: '',
              gender: 'Nam',
              cccd: placeholderCccd,
              ethnic: 'Kinh',
              voter_card_number: '',
              address: 'CHƯA XÁC ĐỊNH',
              group_name: 'Tổ --',
              neighborhood_id: getNeighborhoodIdFromAreaId(currentDetectedAreaId),
              unit_id: getUnitIdFromAreaId(currentDetectedAreaId),
              area_id: currentDetectedAreaId,
              voting_status: 'chua-bau',
              residence_status: 'thuong-tru',
              vote_qh: true,
              vote_t: true,
              vote_p: true
            };

            failedList.push({
              lineIndex: index + 1,
              rawContent: trimmedLine.substring(0, 100) + '...',
              reason: 'Thiếu số CCCD (hoặc định dạng không hợp lệ). Bạn có thể bấm "Thêm vào" để bổ sung sau.',
              suggestion: 'Bấm nút "Thêm vào" để chấp nhận dòng này với CCCD tạm.',
              canForceAdd: true,
              parsedData: tempVoter
            });
            return;
          }
          skippedCount++;
          return;
        }

        const cccd = cccdMatch[0];
        const cccdIndex = trimmedLine.indexOf(cccd);

        // Chuẩn bị dữ liệu trước CCCD để tìm Tên và Ngày sinh
        const preCccdText = trimmedLine.substring(0, cccdIndex).trim();

        // 2. Tìm Ngày sinh - Chấp nhận MỌI định dạng có chứa số và dấu phân cách
        let dob = '';
        let dobIndex = -1;

        // Thử nhiều pattern khác nhau, từ chuẩn đến không chuẩn
        const datePatterns = [
          /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/,  // DD/MM/YYYY hoặc DD/MM/YY
          /\b\d{1,2}[\/\-\.]\d{2,4}\d{2,4}\b/,         // DD/MMYYYY (không có dấu phân cách giữa)
          /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,3}\b/, // DD/MM/YYY (thiếu 1 chữ số năm)
          /\b(19\d{2}|20\d{2})\b/                       // Chỉ năm YYYY
        ];

        for (const pattern of datePatterns) {
          const match = preCccdText.match(pattern);
          if (match) {
            dob = match[0];
            dobIndex = preCccdText.indexOf(dob);
            break;
          }
        }

        // 3. Trích xuất HỌ TÊN (Trước ngày sinh hoặc trước Giới tính nếu không có ngày sinh)
        let name = '';
        let gender = 'Nam';

        if (dob && dobIndex > -1) {
          // Có ngày sinh: Tên nằm trước ngày sinh
          const preDobText = preCccdText.substring(0, dobIndex).trim();
          // Remove leading numbers (STT) and dots
          name = preDobText.replace(/^[\d\.\s]+/, '').trim().toUpperCase();

          // Giới tính nằm giữa DOB và CCCD
          const genderSection = preCccdText.substring(dobIndex + dob.length).trim().toUpperCase();
          if (genderSection.includes('NỮ') || genderSection.includes('NU') || genderSection.includes('X')) {
            gender = 'Nữ';
          }
        } else {
          // Không có ngày sinh: Tên nằm trước Giới tính hoặc trước CCCD
          // Thử tìm giới tính ở cuối đoạn preCccdText
          const genderMatch = preCccdText.match(/(\s)(NAM|NỮ|NU|X)(\s|$)/i);
          if (genderMatch) {
            name = preCccdText.substring(0, genderMatch.index).replace(/^[\d\.\s]+/, '').trim().toUpperCase();
            const gStr = genderMatch[0].toUpperCase();
            if (gStr.includes('NỮ') || gStr.includes('NU') || gStr.includes('X')) gender = 'Nữ';
          } else {
            // Fallback: Lấy toàn bộ làm tên
            name = preCccdText.replace(/^[\d\.\s]+/, '').trim().toUpperCase();
          }
        }

        let warningReason = '';
        if (name.length < 2) {
          name = 'CHƯA CÓ TÊN';
          warningReason = 'Không tìm thấy Họ Tên hợp lệ.';
        }

        // 5. Phần còn lại sau CCCD: Dân tộc | Cư trú | Địa chỉ | KV | Tổ | KP
        const postCccdText = trimmedLine.substring(cccdIndex + cccd.length).trim();

        // Tìm từ khóa Cư trú
        let residenceStatus = 'thuong-tru';
        let resIndex = -1;
        let resKwLength = 0;

        // Ưu tiên tìm "Tạm trú" trước vì "Thường trú" là mặc định
        if (postCccdText.toLowerCase().includes('tạm trú')) {
          resIndex = postCccdText.toLowerCase().indexOf('tạm trú');
          residenceStatus = 'tam-tru';
          resKwLength = 'Tạm trú'.length;
        } else if (postCccdText.toLowerCase().includes('thường trú')) {
          resIndex = postCccdText.toLowerCase().indexOf('thường trú');
          residenceStatus = 'thuong-tru';
          resKwLength = 'Thường trú'.length;
        }

        // Dân tộc (Trước từ khóa Cư trú)
        let ethnic = 'Kinh';
        let addressStartIndex = 0;

        if (resIndex !== -1) {
          const ethnicPart = postCccdText.substring(0, resIndex).trim();
          if (ethnicPart) ethnic = ethnicPart.replace(/[^a-zA-ZÀ-ỹ\s]/g, ''); // Clean special chars
          addressStartIndex = resIndex + resKwLength;
        } else {
          // Fallback: Lấy từ đầu tiên sau CCCD làm dân tộc
          const spaceIdx = postCccdText.indexOf(' ');
          if (spaceIdx > -1) {
            ethnic = postCccdText.substring(0, spaceIdx);
            addressStartIndex = spaceIdx;
          }
        }

        // Xử lý phần còn lại: Địa chỉ ... KV... Tổ... KP...
        let remaining = postCccdText.substring(addressStartIndex).trim();

        // Tìm KV (KV21, KV01...)
        // Thường KV nằm ở cuối phần địa chỉ, trước phần Tổ/KP cuối cùng
        const kvMatch = remaining.match(/KV\d+/i);
        let areaId = currentDetectedAreaId; // Use detected or default
        let rawAddress = remaining;
        let groupName = 'Tổ --';

        if (kvMatch) {
          areaId = kvMatch[0].toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
          const kvIndex = remaining.indexOf(kvMatch[0]);

          // Địa chỉ là phần trước KV
          rawAddress = remaining.substring(0, kvIndex).trim();

          // Phần sau KV là Tổ và Khu phố (Cột cuối)
          const postKvText = remaining.substring(kvIndex + kvMatch[0].length).trim();

          // Trích xuất Tổ mạnh mẽ hơn (bóc số)
          const groupMatch = postKvText.match(/(?:Tổ|To|Group)[:\s]*(\d+)/i);
          if (groupMatch) {
            groupName = `Tổ ${groupMatch[1]}`;
          } else {
            // Nếu không có từ "Tổ", nhưng có số đơn lẻ ở đầu chuỗi postKvText
            const leadingNumberMatch = postKvText.match(/^\d+/);
            if (leadingNumberMatch) {
              groupName = `Tổ ${leadingNumberMatch[0]}`;
            }
          }
        }

        // Clean Address
        rawAddress = rawAddress.replace(/^[,.\-\s]+/, '').replace(/[,.\-\s]+$/, '');
        // STT
        const sttMatch = trimmedLine.match(/^\d+/);
        const stt = sttMatch ? sttMatch[0] : '0';

        // Dò tìm quyền bầu cử (Tìm x/o ở các cột cuối)
        let vQH = false, vT = false, vP = false; // Mặc định không được bầu nếu không có 'x'

        // Ưu tiên tách cột bằng 2+ spaces
        const parts = trimmedLine.split(/\s{2,}/).map(p => p.trim());
        if (parts.length >= 10) {
          const lastIdx = parts.length - 1;
          const pVal = parts[lastIdx - 1]?.toLowerCase();
          const tVal = parts[lastIdx - 2]?.toLowerCase();
          const qhVal = parts[lastIdx - 3]?.toLowerCase();
          if (pVal === 'x') vP = true;
          if (tVal === 'x') vT = true;
          if (qhVal === 'x') vQH = true;
        } else {
          // Robust Fallback: Lấy các token cuối cùng của dòng và kiểm tra x
          const tokens = trimmedLine.split(/\s+/).filter(t => t.length > 0);
          const lastTokens = tokens.slice(-5); // Lấy tối đa 5 token cuối
          let flagsFound = [];
          // Đi ngược từ cuối lên
          for (let i = lastTokens.length - 1; i >= 0 && flagsFound.length < 3; i--) {
            const val = lastTokens[i].toLowerCase();
            if (val === 'x') {
              flagsFound.push(true);
            }
          }
          // Mapping: Token cuối là P, kế cuối là T, kế tiếp là QH
          if (flagsFound.length >= 1) vP = flagsFound[0];
          if (flagsFound.length >= 2) vT = flagsFound[1];
          if (flagsFound.length >= 3) vQH = flagsFound[2];
        }

        const neighborhoodId = getNeighborhoodIdFromAreaId(areaId);
        const unitId = getUnitIdFromAreaId(areaId);

        if (index < 10) {
          addLog(`LOG (R): Dòng ${index + 1}: ${name} | KV: ${areaId} | Flags: QH=${vQH}, T=${vT}, P=${vP}`, 'info');
        }

        const parsedVoter: ParsedVoter = {
          name,
          dob: dob || '',
          gender,
          cccd,
          ethnic: ethnic || 'Kinh',
          voter_card_number: `${areaId.toUpperCase()}-${stt.padStart(4, '0')}`,
          address: rawAddress.toUpperCase(),
          group_name: groupName,
          neighborhood_id: neighborhoodId,
          unit_id: unitId,
          area_id: areaId,
          voting_status: 'chua-bau',
          residence_status: residenceStatus,
          vote_qh: vQH,
          vote_t: vT,
          vote_p: vP,
          permanent_address: residenceStatus === 'thuong-tru' ? rawAddress.toUpperCase() : '',
          temporary_address: residenceStatus === 'tam-tru' ? rawAddress.toUpperCase() : ''
        };

        // Check for duplicates
        if (votersList.some(v => v.cccd === cccd)) {
          addLog(`Cảnh báo: Phát hiện CCCD trùng lặp trong file: ${cccd} (${name}). Vẫn tiếp tục thêm.`, 'info');
        }

        // Final Decision: Add to success list OR Failed list (Force Addable)
        if (warningReason) {
          failedList.push({
            lineIndex: index + 1,
            rawContent: trimmedLine.substring(0, 100),
            reason: warningReason + ' (Bấm "Thêm vào" để chấp nhận)',
            suggestion: 'Dòng này thiếu thông tin nhưng có thể thêm cưỡng bức.',
            canForceAdd: true,
            parsedData: parsedVoter
          });
        } else {
          votersList.push(parsedVoter);
        }
      });

      const votersToInsert = votersList;

      // BATCH INSERT TO SUPABASE
      if (votersToInsert.length > 0) {
        const BATCH_SIZE = 50; // Giảm kích thước batch để tránh lỗi
        for (let i = 0; i < votersToInsert.length; i += BATCH_SIZE) {
          const batch = votersToInsert.slice(i, i + BATCH_SIZE);

          // Try inserting the whole batch first
          const { error } = await supabase.from('voters').insert(batch);

          if (error) {
            // If batch fails, switch to individual insert mode (Smart Retry)
            addLog(`Lỗi xử lý lô dữ liệu ${i} - ${Math.min(i + BATCH_SIZE, votersToInsert.length)}. Đang thử lại từng dòng để cô lập lỗi...`, 'info');

            for (let j = 0; j < batch.length; j++) {
              const voter = batch[j];
              const { error: singleError } = await supabase.from('voters').insert([voter]);

              if (singleError) {
                // Add to failed list strictly for report table. Avoid excessive logging.
                failedList.push({
                  lineIndex: -1,
                  rawContent: `LỖI INSERT: ${voter.name} | CCCD: ${voter.cccd}`,
                  reason: singleError.message,
                  suggestion: 'Kiểm tra dữ liệu hoặc thử nhập lại dòng này',
                  canForceAdd: false,
                  parsedData: voter // Keep parsedData in case user wants to force retry later
                });
              }
            }
          }
        }
      }

      // Calculate final counts after processing
      const finalFailedCount = failedList.length;
      // votersList ONLY contains valid items (mutually exclusive with failedList and skippedCount)
      const finalSuccessCount = votersList.length;

      setResult({
        totalProcessed: processedCount,
        successCount: finalSuccessCount,
        skippedCount: skippedCount,
        failedRecords: failedList
      });

      const hasError = failedList.length > 0;
      addLog(`Hoàn tất! Thành công: ${votersToInsert.length}, Bỏ qua: ${skippedCount}, Lỗi: ${failedList.length}`, hasError ? 'error' : 'success');

      // LOGGING
      createLog({
        userName: profile?.fullName || profile?.role,
        action: 'NHẬP DỮ LIỆU CỬ TRI',
        details: `Nạp thành công ${votersToInsert.length} bản ghi. Bỏ qua ${skippedCount} bản ghi lỗi.`,
        status: hasError ? 'error' : 'success'
      });

    } catch (err: any) {
      addLog('Lỗi hệ thống: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`space-y-8 pb-40 ${isLargeText ? 'text-lg' : 'text-base'}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-4 border-primary pb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="size-12 rounded-2xl bg-white border-2 flex items-center justify-center text-slate-400 hover:text-primary transition-all shadow-sm">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-3xl font-black uppercase text-slate-900 leading-none">Trung tâm nhập liệu</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              Trình trích xuất đồng bộ theo MASTER DATA 45 KVBP
            </p>
          </div>
        </div>
        <button onClick={handleClearData} className="px-6 py-3 bg-red-50 text-red-600 border-2 border-red-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">
          Làm sạch hệ thống
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* INPUT SECTION */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-xl space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">description</span>
                Dán dữ liệu thô (Copy từ Excel/PDF)
              </h3>
              <div className="flex gap-2">
                <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-lg">STT</span>
                <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-lg">Họ Tên</span>
                <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-lg">Ngày Sinh</span>
                <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-lg">CCCD</span>
                <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">...</span>
              </div>
            </div>
            <textarea
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              placeholder="Paste nội dung danh sách cử tri vào đây..."
              className="w-full h-[400px] p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl font-mono text-xs focus:ring-4 focus:ring-primary/10 focus:bg-white outline-none transition-all custom-scrollbar shadow-inner"
            />
            <div className="flex justify-between items-center pt-4">
              <p className="text-xs font-bold text-slate-400 italic">Hệ thống sẽ tự động bỏ qua dòng tiêu đề.</p>
              <button
                onClick={handleImport}
                disabled={isProcessing || !rawData.trim()}
                className="px-12 py-5 bg-primary text-white rounded-2xl font-black uppercase text-xs shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                {isProcessing ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined text-2xl">database_upload</span>}
                {isProcessing ? 'Đang xử lý...' : 'Phân tích & Nạp dữ liệu'}
              </button>
            </div>
          </div>

          {/* REPORT SECTION (HIỂN THỊ KHI CÓ KẾT QUẢ) */}
          {result && (
            <div className="animate-in slide-in-from-bottom-4 space-y-6">

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-900 text-white p-6 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Tổng xử lý</p>
                  <p className="text-3xl font-black mt-1">{result.totalProcessed}</p>
                </div>
                <div className="bg-emerald-500 text-white p-6 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Thêm thành công</p>
                  <p className="text-3xl font-black mt-1">{result.successCount}</p>
                </div>
                <div className="bg-amber-500 text-white p-6 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Bỏ qua (Thiếu ID)</p>
                  <p className="text-3xl font-black mt-1">{result.skippedCount}</p>
                </div>
                <div className={`${result.failedRecords.length > 0 ? 'bg-admin-red' : 'bg-slate-100 text-slate-400'} text-white p-6 rounded-2xl transition-colors`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${result.failedRecords.length > 0 ? 'opacity-80' : ''}`}>Lỗi nghiệp vụ</p>
                  <p className={`text-3xl font-black mt-1 ${result.failedRecords.length === 0 ? 'text-slate-300' : ''}`}>{result.failedRecords.length}</p>
                </div>
              </div>

              {/* Error Table */}
              {result.failedRecords.length > 0 && (
                <div className="bg-white border-2 border-red-100 rounded-[2rem] overflow-hidden shadow-xl">
                  <div className="px-8 py-4 bg-red-50 border-b border-red-100 flex items-center gap-3">
                    <span className="material-symbols-outlined text-admin-red">report_problem</span>
                    <h3 className="font-black text-admin-red uppercase text-sm">Chi tiết các dòng lỗi ({result.failedRecords.length})</h3>
                  </div>
                  <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 sticky top-0 shadow-sm">
                        <tr>
                          <th className="px-6 py-4 w-16">Dòng</th>
                          <th className="px-6 py-4">Nội dung gốc</th>
                          <th className="px-6 py-4 w-48">Lý do lỗi</th>
                          <th className="px-6 py-4 w-48">Gợi ý</th>
                          <th className="px-6 py-4 w-32 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {result.failedRecords.map((rec, idx) => (
                          <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-400 text-center">{rec.lineIndex}</td>
                            <td className="px-6 py-4 font-mono text-slate-600 truncate max-w-xs" title={rec.rawContent}>{rec.rawContent}</td>
                            <td className="px-6 py-4 font-bold text-admin-red">{rec.reason}</td>
                            <td className="px-6 py-4 font-medium text-slate-500 italic">{rec.suggestion}</td>
                            <td className="px-6 py-4 text-center">
                              {rec.canForceAdd ? (
                                <button
                                  onClick={() => handleForceAdd(rec)}
                                  className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg font-black text-[10px] uppercase hover:bg-emerald-200 transition-all shadow-sm flex items-center gap-1 mx-auto"
                                >
                                  <span className="material-symbols-outlined text-xs">add_circle</span> Thêm ngay
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Cần sửa file</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Vui lòng sửa các dòng trên trong file gốc và thực hiện nhập lại hoặc chọn "Thêm ngay" với dữ liệu còn thiếu.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* LOG SECTION */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl space-y-6 sticky top-24">
            <h3 className="font-black uppercase tracking-widest text-[10px] text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">terminal</span>
              Nhật ký xử lý hệ thống
            </h3>
            <div className="space-y-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2 text-[10px]">
              {importLogs.length === 0 && <p className="text-slate-500 italic">Sẵn sàng phân tích theo bộ chuẩn AN_PHU_LOCATIONS...</p>}
              {importLogs.map((log, i) => (
                <div key={i} className={`font-bold p-3 rounded-xl border border-white/5 animate-in slide-in-from-right-4 ${log.type === 'error' ? 'bg-red-500/10 text-red-400' :
                  log.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-white/5 text-slate-400'
                  }`}>
                  {log.msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
