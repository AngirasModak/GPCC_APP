export default function ExcelCentrePage() {
  return (
    <div>
      <div className="pageHead">
        <div>
          <h1>Excel Centre</h1>
          <p className="muted">
            Import and export GPCC financial data.
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Excel Data Centre</h2>

        <p className="muted">
          Upload, download and manage GPCC financial data
          through Excel files.
        </p>

        <div style={{ marginTop: 20 }}>
          <button className="btn">
            Export Financial Data
          </button>
        </div>
      </div>
    </div>
  );
}