type Item = {
  date: string;
  vendor: string;
  category: string;
  paymentMode: string;
  amount: number;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function TransactionExplorer({
  data,
}: {
  data: Item[];
}) {
  return (
    <div className="transactionCard">
      <div className="transactionHeader">
        <div>
          <div className="eyebrow">
            TRANSACTION ANALYSIS
          </div>

          <h2>
            Largest Expense Transactions
          </h2>
        </div>

        <span>
          Top {Math.min(10, data.length)}
        </span>
      </div>

      <div className="transactionTableWrap">
        <table className="transactionTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Vendor / Payee</th>
              <th>Category</th>
              <th>Payment Mode</th>
              <th>Amount</th>
            </tr>
          </thead>

          <tbody>
            {data.length ? (
              data.map((item, index) => (
                <tr key={index}>
                  <td>{item.date}</td>

                  <td>
                    <strong>
                      {item.vendor}
                    </strong>
                  </td>

                  <td>
                    <span className="categoryPill">
                      {item.category}
                    </span>
                  </td>

                  <td>
                    {item.paymentMode}
                  </td>

                  <td className="amountCell">
                    {money(item.amount)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="emptyState"
                >
                  No expense transactions found
                  for the selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}