from datetime import datetime
import sqlite3

from flask import Flask, jsonify, render_template, request


app = Flask(__name__)
DB_NAME = "expenses.db"


def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                amount REAL NOT NULL CHECK(amount > 0),
                expense_date TEXT NOT NULL,
                note TEXT DEFAULT ''
            )
            """
        )


@app.route("/")
def index():
    return render_template("index.html")


@app.post("/api/expenses")
def add_expense():
    data = request.get_json(silent=True) or {}
    amount = data.get("amount")
    expense_date = data.get("expense_date")
    note = (data.get("note") or "").strip()

    try:
        amount = float(amount)
        datetime.strptime(expense_date, "%Y-%m-%d")
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid amount or date format."}), 400

    if amount <= 0:
        return jsonify({"error": "Amount must be greater than zero."}), 400

    with get_db_connection() as conn:
        conn.execute(
            "INSERT INTO expenses (amount, expense_date, note) VALUES (?, ?, ?)",
            (amount, expense_date, note),
        )
        conn.commit()

    return jsonify({"message": "Expense saved."}), 201


@app.get("/api/monthly-total")
def monthly_total():
    month = request.args.get("month")

    try:
        datetime.strptime(month, "%Y-%m")
    except (TypeError, ValueError):
        return jsonify({"error": "Use month format YYYY-MM."}), 400

    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM expenses
            WHERE strftime('%Y-%m', expense_date) = ?
            """,
            (month,),
        ).fetchone()

    return jsonify({"month": month, "total": round(row["total"], 2)})


@app.get("/api/expenses")
def list_expenses():
    month = request.args.get("month")
    month_filter = None

    if month:
        try:
            datetime.strptime(month, "%Y-%m")
            month_filter = month
        except ValueError:
            return jsonify({"error": "Use month format YYYY-MM."}), 400

    with get_db_connection() as conn:
        if month_filter:
            rows = conn.execute(
                """
                SELECT id, amount, expense_date, note
                FROM expenses
                WHERE strftime('%Y-%m', expense_date) = ?
                ORDER BY expense_date DESC, id DESC
                """,
                (month_filter,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, amount, expense_date, note
                FROM expenses
                ORDER BY expense_date DESC, id DESC
                """
            ).fetchall()
        total_row = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM expenses"
        ).fetchone()

    expenses = [
        {
            "id": row["id"],
            "amount": round(row["amount"], 2),
            "expense_date": row["expense_date"],
            "note": row["note"] or "",
        }
        for row in rows
    ]

    return jsonify(
        {
            "expenses": expenses,
            "total_expenses": round(total_row["total_expenses"], 2),
        }
    )


@app.put("/api/expenses/<int:expense_id>")
def update_expense(expense_id):
    data = request.get_json(silent=True) or {}
    amount = data.get("amount")
    expense_date = data.get("expense_date")
    note = (data.get("note") or "").strip()

    try:
        amount = float(amount)
        datetime.strptime(expense_date, "%Y-%m-%d")
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid amount or date format."}), 400

    if amount <= 0:
        return jsonify({"error": "Amount must be greater than zero."}), 400

    with get_db_connection() as conn:
        result = conn.execute(
            """
            UPDATE expenses
            SET amount = ?, expense_date = ?, note = ?
            WHERE id = ?
            """,
            (amount, expense_date, note, expense_id),
        )
        conn.commit()

    if result.rowcount == 0:
        return jsonify({"error": "Expense not found."}), 404

    return jsonify({"message": "Expense updated."})


@app.delete("/api/expenses/<int:expense_id>")
def delete_expense(expense_id):
    with get_db_connection() as conn:
        result = conn.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
        conn.commit()

    if result.rowcount == 0:
        return jsonify({"error": "Expense not found."}), 404

    return jsonify({"message": "Expense deleted."})


init_db()

if __name__ == "__main__":
    app.run(debug=True)
