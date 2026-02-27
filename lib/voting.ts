/**
 * Logic xác định số lượng đại biểu cần bầu dựa trên số lượng ứng cử viên
 * 
 * Quy tắc:
 * - 7 ứng cử viên: Bầu 4 đại biểu (Bỏ 3)
 * - 5 ứng cử viên: Bầu 3 đại biểu (Bỏ 2)
 * - 4 ứng cử viên: Bầu 2 đại biểu (Bỏ 2) - Theo thực tế các ví dụ trong ảnh
 */
export const getDelegateCount = (candidateCount: number): number => {
    if (candidateCount >= 7) return 4;
    if (candidateCount >= 5) return 3;
    if (candidateCount >= 4) return 2;
    return 0; // Mặc định hoặc trường hợp đặc biệt
};
