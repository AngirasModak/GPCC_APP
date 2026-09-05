export type IncomeRow = {
  amount: number | null;
  mode: string | null;
  status: string | null;
  deleted_at?: string | null;
};

export type ExpenseRow = {
  gross_amount: number | null;
  net_amount: number | null;
  tds_amount?: number | null;
  tds_rate?: number | null;
  payment_mode: string | null;
  status: string | null;
  deleted_at?: string | null;
};

export type TransferRow = {
  amount: number | null;
  type: string | null;
  direction: "IN" | "OUT" | string | null;
  deleted_at?: string | null;
};

const numberValue = (
  value: number | null | undefined
) => Number(value || 0);

const normalize = (
  value: string | null | undefined
) =>
  String(value || "")
    .trim()
    .toLowerCase();

/*
 * ==========================================
 * INCOME CALCULATIONS
 * ==========================================
 */

export const getClearedIncome = (
  incomes: IncomeRow[]
) =>
  incomes.filter(
    (row) =>
      row.status === "Cleared" &&
      !row.deleted_at
  );

export const calculateTotalIncome = (
  incomes: IncomeRow[]
) =>
  getClearedIncome(incomes).reduce(
    (sum, row) =>
      sum + numberValue(row.amount),
    0
  );

export const calculateBankIncome = (
  incomes: IncomeRow[]
) =>
  getClearedIncome(incomes)
    .filter(
      (row) =>
        normalize(row.mode) !== "cash"
    )
    .reduce(
      (sum, row) =>
        sum + numberValue(row.amount),
      0
    );

export const calculateCashIncome = (
  incomes: IncomeRow[]
) =>
  getClearedIncome(incomes)
    .filter(
      (row) =>
        normalize(row.mode) === "cash"
    )
    .reduce(
      (sum, row) =>
        sum + numberValue(row.amount),
      0
    );

/*
 * ==========================================
 * EXPENSE CALCULATIONS
 * ==========================================
 */

export const getPaidExpenses = (
  expenses: ExpenseRow[]
) =>
  expenses.filter(
    (row) =>
      row.status === "Paid" &&
      !row.deleted_at
  );

export const calculateTotalExpense = (
  expenses: ExpenseRow[]
) =>
  getPaidExpenses(expenses).reduce(
    (sum, row) =>
      sum +
      numberValue(row.gross_amount),
    0
  );

export const calculateTotalTds = (
  expenses: ExpenseRow[]
) =>
  getPaidExpenses(expenses).reduce(
    (sum, row) => {
      const tds =
        row.tds_amount !== null &&
        row.tds_amount !== undefined
          ? numberValue(row.tds_amount)
          : numberValue(
              row.gross_amount
            ) *
            numberValue(row.tds_rate) /
            100;

      return sum + tds;
    },
    0
  );

/*
 * ==========================================
 * BANK EXPENSE
 *
 * Same logic as Bank & Transfers page.
 *
 * Paid expense
 * AND
 * payment mode is NOT Petty Cash.
 *
 * Gross amount is used intentionally to match
 * the current Bank & Transfers calculation.
 * ==========================================
 */

export const calculateBankExpense = (
  expenses: ExpenseRow[]
) =>
  getPaidExpenses(expenses)
    .filter(
      (row) =>
        normalize(
          row.payment_mode
        ) !== "petty cash"
    )
    .reduce(
      (sum, row) =>
        sum +
        numberValue(
          row.gross_amount
        ),
      0
    );

/*
 * ==========================================
 * PETTY CASH EXPENSE
 *
 * Paid expense
 * AND
 * payment mode = Petty Cash.
 *
 * Net amount is the actual cash paid.
 * ==========================================
 */

export const calculatePettyCashExpense = (
  expenses: ExpenseRow[]
) =>
  getPaidExpenses(expenses)
    .filter(
      (row) =>
        normalize(
          row.payment_mode
        ) === "petty cash"
    )
    .reduce(
      (sum, row) =>
        sum +
        numberValue(
          row.net_amount
        ),
      0
    );

/*
 * ==========================================
 * FUND TRANSFER FILTER
 * ==========================================
 */

export const getActiveTransfers = (
  transfers: TransferRow[]
) =>
  transfers.filter(
    (row) => !row.deleted_at
  );

/*
 * ==========================================
 * BANK → PETTY CASH
 *
 * Supports legacy transaction names.
 * ==========================================
 */

export const calculateBankToPettyCash = (
  transfers: TransferRow[]
) =>
  getActiveTransfers(transfers)
    .filter(
      (row) =>
        row.type ===
          "Bank Withdrawal" ||
        row.type ===
          "Withdrawal"
    )
    .reduce(
      (sum, row) =>
        sum +
        numberValue(row.amount),
      0
    );

/*
 * ==========================================
 * PETTY CASH → BANK
 *
 * Supports legacy transaction names.
 * ==========================================
 */

export const calculatePettyCashToBank = (
  transfers: TransferRow[]
) =>
  getActiveTransfers(transfers)
    .filter(
      (row) =>
        row.type ===
          "Petty Cash to Bank" ||
        row.type ===
          "Cash Deposit" ||
        row.type ===
          "Deposit" ||
        row.type ===
          "Petty Cash Deposit" ||
        row.type ===
          "Return to Bank"
    )
    .reduce(
      (sum, row) =>
        sum +
        numberValue(row.amount),
      0
    );

/*
 * ==========================================
 * BANK ADJUSTMENTS
 * ==========================================
 */

export const calculateBankAdjustmentCredit = (
  transfers: TransferRow[]
) =>
  getActiveTransfers(transfers)
    .filter(
      (row) =>
        row.type ===
          "Bank Adjustment" &&
        row.direction === "IN"
    )
    .reduce(
      (sum, row) =>
        sum +
        numberValue(row.amount),
      0
    );

export const calculateBankAdjustmentDebit = (
  transfers: TransferRow[]
) =>
  getActiveTransfers(transfers)
    .filter(
      (row) =>
        row.type ===
          "Bank Adjustment" &&
        row.direction === "OUT"
    )
    .reduce(
      (sum, row) =>
        sum +
        numberValue(row.amount),
      0
    );

/*
 * ==========================================
 * CASH ADJUSTMENTS
 *
 * Supports:
 *
 * Cash Adjustment
 * Cash Adjustment +
 * Cash Adjustment -
 * ==========================================
 */

export const calculateCashAdjustmentCredit = (
  transfers: TransferRow[]
) =>
  getActiveTransfers(transfers)
    .filter(
      (row) =>
        (
          row.type ===
            "Cash Adjustment" ||
          row.type ===
            "Cash Adjustment +"
        ) &&
        row.direction === "IN"
    )
    .reduce(
      (sum, row) =>
        sum +
        numberValue(row.amount),
      0
    );

export const calculateCashAdjustmentDebit = (
  transfers: TransferRow[]
) =>
  getActiveTransfers(transfers)
    .filter(
      (row) =>
        (
          row.type ===
            "Cash Adjustment" ||
          row.type ===
            "Cash Adjustment -"
        ) &&
        row.direction === "OUT"
    )
    .reduce(
      (sum, row) =>
        sum +
        numberValue(row.amount),
      0
    );

/*
 * ==========================================
 * COMPLETE FINANCIAL CALCULATION
 *
 * This is the main function that should be
 * used by Dashboard, Bank & Transfers and
 * Petty Cash.
 * ==========================================
 */

export const calculateFinancialPosition = ({
  bankOpeningBalance,
  pettyCashOpeningBalance,
  incomes,
  expenses,
  transfers,
}: {
  bankOpeningBalance: number;
  pettyCashOpeningBalance: number;
  incomes: IncomeRow[];
  expenses: ExpenseRow[];
  transfers: TransferRow[];
}) => {
  const income =
    calculateTotalIncome(incomes);

  const expense =
    calculateTotalExpense(expenses);

  const tds =
    calculateTotalTds(expenses);

  const bankIncome =
    calculateBankIncome(incomes);

  const cashIncome =
    calculateCashIncome(incomes);

  const bankExpense =
    calculateBankExpense(expenses);

  const pettyCashExpense =
    calculatePettyCashExpense(expenses);

  const bankToPettyCash =
    calculateBankToPettyCash(transfers);

  const pettyCashToBank =
    calculatePettyCashToBank(transfers);

  const bankAdjustmentCredit =
    calculateBankAdjustmentCredit(
      transfers
    );

  const bankAdjustmentDebit =
    calculateBankAdjustmentDebit(
      transfers
    );

  const cashAdjustmentCredit =
    calculateCashAdjustmentCredit(
      transfers
    );

  const cashAdjustmentDebit =
    calculateCashAdjustmentDebit(
      transfers
    );

  /*
   * BANK POSITION
   */

  const bank =
    numberValue(bankOpeningBalance) +
    bankIncome -
    bankExpense -
    bankToPettyCash +
    pettyCashToBank +
    bankAdjustmentCredit -
    bankAdjustmentDebit;

  /*
   * PETTY CASH POSITION
   */

  const pettyCash =
    numberValue(
      pettyCashOpeningBalance
    ) +
    cashIncome +
    bankToPettyCash -
    pettyCashExpense -
    pettyCashToBank +
    cashAdjustmentCredit -
    cashAdjustmentDebit;

  /*
   * TOTAL GPCC FUNDS
   */

  const totalFunds =
    bank + pettyCash;

  return {
    income,
    expense,
    tds,

    bankIncome,
    bankExpense,

    cashIncome,
    pettyCashExpense,

    bankToPettyCash,
    pettyCashToBank,

    bankAdjustmentCredit,
    bankAdjustmentDebit,

    cashAdjustmentCredit,
    cashAdjustmentDebit,

    bank,
    pettyCash,
    totalFunds,
  };
};