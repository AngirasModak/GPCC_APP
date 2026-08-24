export default function Home() {
  return (
    <section style={{ padding: "60px 0" }}>
      <h1>GPOA Cultural Finance Portal</h1>

      <p>
        Centralized, secure and role-controlled management of cultural
        subscriptions, expenditure, petty cash, TDS, documents and audit
        history.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 20,
          marginTop: 30,
        }}
      >
        <div
          style={{
            background: "white",
            padding: 20,
            borderRadius: 12,
          }}
        >
          <h3>Income & Subscription</h3>
          <p>Cash, cheque and online payment tracking.</p>
        </div>

        <div
          style={{
            background: "white",
            padding: 20,
            borderRadius: 12,
          }}
        >
          <h3>Expenditure & TDS</h3>
          <p>Requisition, vendor, bill, payment and TDS management.</p>
        </div>

        <div
          style={{
            background: "white",
            padding: 20,
            borderRadius: 12,
          }}
        >
          <h3>Petty Cash</h3>
          <p>Track cash availability and petty cash expenses.</p>
        </div>

        <div
          style={{
            background: "white",
            padding: 20,
            borderRadius: 12,
          }}
        >
          <h3>Reports & Audit</h3>
          <p>Centralized reporting, visualization and audit history.</p>
        </div>
      </div>
    </section>
  );
}