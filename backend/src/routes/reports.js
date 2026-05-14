import express from 'express';
import { query } from '../../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { buildLineProcessingHtmlReport } from '../services/lineProcessingReportService.js';

const router = express.Router();

const parseIso = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

const bucketExpressionSql = (granularity) => {
  switch (granularity) {
    case 'raw':
      return 'sampled_at';
    case '1m':
      return `date_trunc('minute', sampled_at)`;
    case '15m':
      return `date_trunc('hour', sampled_at) + (floor(extract(minute from sampled_at) / 15) * interval '15 minutes')`;
    case '1h':
    default:
      return `date_trunc('hour', sampled_at)`;
  }
};

/**
 * GET /api/reports/factory-telemetry
 * Export all machines / all line parameters for reporting and AI.
 *
 * Query:
 * - from, to: ISO 8601 (required)
 * - granularity: raw | 1m | 15m | 1h (default 1h)
 * - format: json | csv (default json)
 * - machineId: optional filter
 */
router.get('/factory-telemetry', authenticateToken, async (req, res) => {
  try {
    const from = parseIso(req.query.from);
    const to = parseIso(req.query.to);
    if (!from || !to || from >= to) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'from and to are required ISO timestamps; from must be before to',
      });
    }

    const granularity = String(req.query.granularity || '1h').toLowerCase();
    if (!['raw', '1m', '15m', '1h'].includes(granularity)) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'granularity must be one of: raw, 1m, 15m, 1h',
      });
    }

    const format = String(req.query.format || 'json').toLowerCase();
    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'format must be json or csv',
      });
    }

    const machineId = req.query.machineId ? String(req.query.machineId).trim() : null;

    const spanMs = to.getTime() - from.getTime();
    const maxRawMs = machineId ? 7 * 24 * 60 * 60 * 1000 : 2 * 24 * 60 * 60 * 1000;
    const maxAggMs = 366 * 24 * 60 * 60 * 1000;

    if (granularity === 'raw' && spanMs > maxRawMs) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: machineId
          ? 'For raw granularity, maximum range is 7 days when machineId is set'
          : 'For raw granularity, maximum range is 2 days (set machineId for up to 7 days)',
      });
    }

    if (granularity !== 'raw' && spanMs > maxAggMs) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'For aggregated granularity, maximum range is 366 days',
      });
    }

    const bucketExpr = bucketExpressionSql(granularity);
    const params = [from, to];
    let machineClause = '';
    if (machineId) {
      params.push(machineId);
      machineClause = ` AND machine_id = $${params.length}`;
    }

    let sql;
    if (granularity === 'raw') {
      sql = `
        SELECT
          sampled_at AS bucket_start,
          machine_id,
          area,
          status,
          line_speed,
          target_speed,
          produced_length,
          produced_length_ok,
          produced_length_ng,
          target_length,
          production_order_id,
          production_order_name,
          material_code,
          product_name,
          operator_name,
          oee,
          availability,
          performance,
          quality,
          performance_data_quality,
          quality_data_quality,
          motor_current,
          power_kw,
          energy_meter_kwh,
          temperature,
          multi_zone_temperatures,
          health_score,
          vibration_level,
          runtime_hours,
          source,
          data_quality_flags
        FROM machine_line_telemetry
        WHERE sampled_at >= $1 AND sampled_at < $2
        ${machineClause}
        ORDER BY sampled_at ASC, machine_id ASC
        LIMIT 250000`;
    } else {
      sql = `
        SELECT
          ${bucketExpr} AS bucket_start,
          machine_id,
          area,
          COUNT(*)::bigint AS sample_count,
          AVG(line_speed) FILTER (WHERE line_speed IS NOT NULL) AS avg_line_speed,
          AVG(target_speed) FILTER (WHERE target_speed IS NOT NULL) AS avg_target_speed,
          AVG(produced_length) FILTER (WHERE produced_length IS NOT NULL) AS avg_produced_length,
          AVG(produced_length_ok) FILTER (WHERE produced_length_ok IS NOT NULL) AS avg_produced_length_ok,
          AVG(produced_length_ng) FILTER (WHERE produced_length_ng IS NOT NULL) AS avg_produced_length_ng,
          (ARRAY_AGG(production_order_id ORDER BY sampled_at DESC) FILTER (WHERE production_order_id IS NOT NULL))[1] AS production_order_id_last,
          (ARRAY_AGG(material_code ORDER BY sampled_at DESC) FILTER (WHERE material_code IS NOT NULL))[1] AS material_code_last,
          (ARRAY_AGG(product_name ORDER BY sampled_at DESC) FILTER (WHERE product_name IS NOT NULL))[1] AS product_name_last,
          AVG(oee) FILTER (WHERE oee IS NOT NULL) AS avg_oee,
          AVG(availability) FILTER (WHERE availability IS NOT NULL) AS avg_availability,
          AVG(performance) FILTER (WHERE performance IS NOT NULL) AS avg_performance,
          AVG(quality) FILTER (WHERE quality IS NOT NULL) AS avg_quality,
          AVG(motor_current) FILTER (WHERE motor_current IS NOT NULL) AS avg_motor_current,
          AVG(power_kw) FILTER (WHERE power_kw IS NOT NULL) AS avg_power_kw,
          MIN(energy_meter_kwh) FILTER (WHERE energy_meter_kwh IS NOT NULL) AS meter_min_kwh,
          MAX(energy_meter_kwh) FILTER (WHERE energy_meter_kwh IS NOT NULL) AS meter_max_kwh,
          AVG(temperature) FILTER (WHERE temperature IS NOT NULL) AS avg_temperature,
          AVG(health_score) FILTER (WHERE health_score IS NOT NULL) AS avg_health_score,
          AVG(runtime_hours) FILTER (WHERE runtime_hours IS NOT NULL) AS avg_runtime_hours,
          BOOL_OR((data_quality_flags & 1) = 1) AS any_meter_reset_flag
        FROM machine_line_telemetry
        WHERE sampled_at >= $1 AND sampled_at < $2
        ${machineClause}
        GROUP BY ${bucketExpr}, machine_id, area
        ORDER BY bucket_start ASC, machine_id ASC
        LIMIT 500000`;
    }

    const result = await query(sql, params);

    if (format === 'csv') {
      const rows = result.rows;
      if (rows.length === 0) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="factory-telemetry.csv"');
        return res.send('');
      }
      const headers = Object.keys(rows[0]);
      const escape = (v) => {
        if (v === null || v === undefined) return '';
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const lines = [headers.join(',')];
      for (const row of rows) {
        lines.push(headers.map((h) => escape(row[h])).join(','));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="factory-telemetry.csv"');
      return res.send(lines.join('\n'));
    }

    return res.json({
      data: result.rows,
      meta: {
        from: from.toISOString(),
        to: to.toISOString(),
        granularity,
        rowCount: result.rows.length,
        machineId: machineId || null,
      },
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('factory-telemetry report error:', error);
    return res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/reports/line-processing.html
 * HTML export: processing by shift/day, product sessions from telemetry, status history clipped.
 *
 * Query (JWT required):
 * - localDate: YYYY-MM-DD (required, server local calendar anchor)
 * - shift: 1 | 2 | 3 (optional; omit = all three shifts on that date)
 * - area: drawing | stranding | armoring | sheathing — XOR —
 * - machineIds: comma-separated machine ids
 */
router.get('/line-processing.html', authenticateToken, async (req, res) => {
  try {
    const out = await buildLineProcessingHtmlReport({
      localDate: req.query.localDate,
      shift: req.query.shift,
      area: req.query.area,
      machineIds: req.query.machineIds,
    });
    if (out.error) {
      return res.status(out.status).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: out.error,
      });
    }
    const safeName = String(out.filename).replace(/[^\w.\-()+]/g, '_');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    return res.send(out.html);
  } catch (error) {
    console.error('line-processing.html report error:', error);
    return res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

export default router;
