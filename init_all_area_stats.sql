-- ===================================================================
-- GIẢI PHÁP NHANH: TẠO RECORD AREA_STATS CHO TẤT CẢ KVBP
-- ===================================================================
-- Script này tạo bản ghi area_stats cho tất cả 45 KVBP
-- Điều này cho phép nhập liệu ngay cả khi chưa có cử tri trong database
-- ===================================================================

-- Tạo area_stats cho tất cả các KVBP (kv1 đến kv45)
INSERT INTO area_stats (area_id, total_voters, issued_votes, received_votes, valid_votes, invalid_votes, is_locked, updated_at)
SELECT 
    all_areas.area_id,
    COALESCE(voter_counts.voter_count, 0) as total_voters,
    0 as issued_votes,
    0 as received_votes,
    0 as valid_votes,
    0 as invalid_votes,
    false as is_locked,
    NOW() as updated_at
FROM (
    -- Danh sách tất cả 45 KVBP
    SELECT 'kv1' as area_id UNION ALL SELECT 'kv2' UNION ALL SELECT 'kv3' UNION ALL
    SELECT 'kv4' UNION ALL SELECT 'kv5' UNION ALL SELECT 'kv6' UNION ALL
    SELECT 'kv7' UNION ALL SELECT 'kv8' UNION ALL SELECT 'kv9' UNION ALL
    SELECT 'kv10' UNION ALL SELECT 'kv11' UNION ALL SELECT 'kv12' UNION ALL
    SELECT 'kv13' UNION ALL SELECT 'kv14' UNION ALL SELECT 'kv15' UNION ALL
    SELECT 'kv16' UNION ALL SELECT 'kv17' UNION ALL SELECT 'kv18' UNION ALL
    SELECT 'kv19' UNION ALL SELECT 'kv20' UNION ALL SELECT 'kv21' UNION ALL
    SELECT 'kv22' UNION ALL SELECT 'kv23' UNION ALL SELECT 'kv24' UNION ALL
    SELECT 'kv25' UNION ALL SELECT 'kv26' UNION ALL SELECT 'kv27' UNION ALL
    SELECT 'kv28' UNION ALL SELECT 'kv29' UNION ALL SELECT 'kv30' UNION ALL
    SELECT 'kv31' UNION ALL SELECT 'kv32' UNION ALL SELECT 'kv33' UNION ALL
    SELECT 'kv34' UNION ALL SELECT 'kv35' UNION ALL SELECT 'kv36' UNION ALL
    SELECT 'kv37' UNION ALL SELECT 'kv38' UNION ALL SELECT 'kv39' UNION ALL
    SELECT 'kv40' UNION ALL SELECT 'kv41' UNION ALL SELECT 'kv42' UNION ALL
    SELECT 'kv43' UNION ALL SELECT 'kv44' UNION ALL SELECT 'kv45'
) all_areas
LEFT JOIN (
    -- Đếm số cử tri thực tế cho mỗi KVBP
    SELECT area_id, COUNT(*) as voter_count
    FROM voters
    GROUP BY area_id
) voter_counts ON all_areas.area_id = voter_counts.area_id
ON CONFLICT (area_id) 
DO UPDATE SET
    total_voters = COALESCE((SELECT COUNT(*) FROM voters WHERE area_id = EXCLUDED.area_id), 0),
    updated_at = NOW();

-- Kiểm tra kết quả
SELECT 
    a.area_id,
    a.total_voters as stats_total,
    COALESCE(v.actual_count, 0) as actual_voters,
    CASE 
        WHEN a.total_voters = COALESCE(v.actual_count, 0) THEN '✓ OK'
        ELSE '⚠ Mismatch'
    END as status
FROM area_stats a
LEFT JOIN (
    SELECT area_id, COUNT(*) as actual_count
    FROM voters
    GROUP BY area_id
) v ON a.area_id = v.area_id
ORDER BY a.area_id;

-- ===================================================================
-- KẾT QUẢ MONG ĐỢI:
-- ===================================================================
-- - Tất cả 45 KVBP đều có bản ghi trong area_stats
-- - KVBP 21 sẽ có total_voters = 0 (hoặc số thực tế nếu có dữ liệu)
-- - Trang Data Entry sẽ hiển thị "Tổng cử tri: 0" thay vì lỗi
-- - Có thể nhập liệu kết quả bầu cử cho KVBP 21
-- ===================================================================
