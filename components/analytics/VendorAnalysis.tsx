type Item = {
  name: string;
  amount: number;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function VendorAnalysis({
  data,
}: {
  data: Item[];
}) {
  const max =
    Math.max(
      ...data.map((x) => x.amount),
      1
    );

  return (
    <div className="vendorCard">
      <div className="eyebrow">
        VENDOR ANALYSIS
      </div>

      <h2>Top Expense Recipients</h2>

      <div className="vendorList">
        {data.slice(0, 6).map(
          (item, index) => (
            <div
              className="vendorItem"
              key={index}
            >
              <div className="vendorRank">
                {String(index + 1).padStart(
                  2,
                  "0"
                )}
              </div>

              <div className="vendorInfo">
                <div className="vendorTop">
                  <strong>
                    {item.name}
                  </strong>

                  <span>
                    {money(item.amount)}
                  </span>
                </div>

                <div className="vendorTrack">
                  <div
                    className="vendorFill"
                    style={{
                      width: `${
                        (item.amount / max) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}