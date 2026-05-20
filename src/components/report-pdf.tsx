import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { PlausibilityReport } from "@/lib/report-engine";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  h1: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 6 },
  muted: { color: "#666" },
  row: { flexDirection: "row" },
  tableHeader: { flexDirection: "row", borderBottom: 1, borderColor: "#ddd", paddingBottom: 3, fontWeight: 700 },
  tableRow: { flexDirection: "row", borderBottom: 0.5, borderColor: "#eee", paddingVertical: 2 },
  c1: { flex: 3 },
  c2: { flex: 1 },
  c3: { flex: 1 },
  c4: { flex: 2 },
  c5: { flex: 1 },
  bar: { backgroundColor: "#3b82f6", height: 6, marginRight: 4 },
});

function p(p: number) {
  return p < 0.001 ? "<0.001" : p.toFixed(3);
}

export function ReportPdf({ report }: { report: PlausibilityReport }) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.h1}>Plausibility Report</Text>
        <Text style={styles.muted}>
          {report.meta.formId} · {report.meta.fromDate}
          {report.meta.toDate && report.meta.toDate !== report.meta.fromDate ? ` to ${report.meta.toDate}` : ""} ·
          {" "}{report.meta.totalRecords} records · {report.meta.referenceStandard}
        </Text>

        <Text style={styles.h2}>Overall data quality</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.c1}>Criterion</Text>
          <Text style={styles.c2}>Flags</Text>
          <Text style={styles.c3}>Unit</Text>
          <Text style={styles.c4}>Value</Text>
          <Text style={styles.c5}>Score</Text>
        </View>
        {report.overallScore.rows.map((r) => (
          <View key={r.label} style={styles.tableRow}>
            <Text style={styles.c1}>{r.label}</Text>
            <Text style={styles.c2}>{r.flag}</Text>
            <Text style={styles.c3}>{r.unit}</Text>
            <Text style={styles.c4}>{r.value}</Text>
            <Text style={styles.c5}>{r.score}</Text>
          </View>
        ))}
        <Text style={{ marginTop: 4 }}>
          Overall score: <Text style={{ fontWeight: 700 }}>{report.overallScore.totalScore}</Text>
          {" "}({report.overallScore.bandLabel})
        </Text>

        <Text style={styles.h2}>Missing data & birthdate</Text>
        <Text>Children with exact birthday: {report.missing.pctWithBirthdate}%</Text>
        <Text>Rows missing weight: {report.missing.weight.length}</Text>
        <Text>Rows missing height: {report.missing.height.length}</Text>

        <Text style={styles.h2}>Sex × age</Text>
        <Text style={styles.muted}>
          Overall sex ratio p={p(report.sexAge.pSex)} · Age ratio (6-29 vs 30-59) p=
          {p(report.sexAge.pAgeRatio)} · Overall age distribution p={p(report.sexAge.pAge)}
        </Text>
        <View style={[styles.tableHeader, { marginTop: 4 }]}>
          <Text style={styles.c1}>Age band</Text>
          <Text style={styles.c2}>Mo.</Text>
          <Text style={styles.c2}>Boys</Text>
          <Text style={styles.c2}>Girls</Text>
          <Text style={styles.c2}>Total</Text>
        </View>
        {report.sexAge.cells.map((c) => (
          <View key={c.ageBand} style={styles.tableRow}>
            <Text style={styles.c1}>{c.ageBand}</Text>
            <Text style={styles.c2}>{c.months}</Text>
            <Text style={styles.c2}>{c.obsBoys}/{c.expBoys.toFixed(1)}</Text>
            <Text style={styles.c2}>{c.obsGirls}/{c.expGirls.toFixed(1)}</Text>
            <Text style={styles.c2}>{c.obsBoys + c.obsGirls}</Text>
          </View>
        ))}

        <Text style={styles.h2}>Age distribution (months)</Text>
        {report.ageDistribution.map((d) => (
          <View key={d.month} style={[styles.row, { alignItems: "center" }]}>
            <Text style={{ width: 30 }}>{d.month}</Text>
            <View style={{ ...styles.bar, width: Math.max(0, d.count) * 6 }} />
            <Text>{d.count}</Text>
          </View>
        ))}

        <Text style={styles.h2}>Digit preference — MUAC (mm)</Text>
        <Text style={styles.muted}>DPS = {report.digitPref.muac?.dps ?? "—"}</Text>
        {(report.digitPref.muac?.percents ?? []).map((pct, i) => (
          <View key={i} style={[styles.row, { alignItems: "center" }]}>
            <Text style={{ width: 30 }}>.{i}</Text>
            <View style={{ ...styles.bar, width: Math.max(0, pct) * 4 }} />
            <Text>{pct.toFixed(1)}%</Text>
          </View>
        ))}

        <Text style={styles.h2}>Team performance summary</Text>
        <Text style={styles.muted}>Doing well:</Text>
        {report.teamSummary.filter((t) => t.band === "excellent" || t.band === "good").length === 0 ? (
          <Text>—</Text>
        ) : (
          report.teamSummary
            .filter((t) => t.band === "excellent" || t.band === "good")
            .map((t) => (
              <Text key={t.team}>
                {t.team} (n={t.n}, score {t.totalScore}, {t.band})
              </Text>
            ))
        )}
        <Text style={[styles.muted, { marginTop: 4 }]}>Needs review:</Text>
        {report.teamSummary.filter((t) => t.band === "acceptable" || t.band === "problematic").length === 0 ? (
          <Text>All teams within acceptable range.</Text>
        ) : (
          report.teamSummary
            .filter((t) => t.band === "acceptable" || t.band === "problematic")
            .map((t) => (
              <View key={t.team} style={{ marginBottom: 2 }}>
                <Text>
                  {t.team} (n={t.n}, score {t.totalScore}, {t.band})
                </Text>
                {t.issues.map((i) => (
                  <Text key={i} style={{ marginLeft: 8, color: "#666" }}>• {i}</Text>
                ))}
              </View>
            ))
        )}

        <Text style={styles.h2}>Analysis by team</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.c1}>Team</Text>
          <Text style={styles.c2}>n</Text>
          <Text style={styles.c2}>Sex m/f</Text>
          <Text style={styles.c2}>Age 6-29/30-59</Text>
          <Text style={styles.c2}>MUAC DPS</Text>
        </View>
        {report.byTeam.map((t) => (
          <View key={t.team} style={styles.tableRow}>
            <Text style={styles.c1}>{t.team}</Text>
            <Text style={styles.c2}>{t.n}</Text>
            <Text style={styles.c2}>{Number.isFinite(t.sexRatio) ? t.sexRatio.toFixed(2) : "—"}</Text>
            <Text style={styles.c2}>{Number.isFinite(t.ageRatio6_29_vs_30_59) ? t.ageRatio6_29_vs_30_59.toFixed(2) : "—"}</Text>
            <Text style={styles.c2}>{t.digitPref.muac ?? "—"}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
