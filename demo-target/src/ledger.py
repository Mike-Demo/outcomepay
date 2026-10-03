#!/usr/bin/env python3
"""
TidyLedger — a tiny fictional command-line budgeting tool.

Sample project for the OutcomePay demo (PayPal AI Hackathon 2026).
The localizer provider agent translates the UI_STRINGS below into Spanish;
the verifier agents check that no English strings remain.
"""

UI_STRINGS = {
    "welcome": "Welcome to TidyLedger!",
    "prompt_amount": "Enter amount: ",
    "prompt_note": "Enter a note: ",
    "income_added": "Income recorded.",
    "expense_added": "Expense recorded.",
    "invalid_amount": "That doesn't look like a number — try again.",
    "monthly_summary": "Monthly summary",
    "total_income": "Total income",
    "total_expenses": "Total expenses",
    "balance": "Balance",
    "no_entries": "No entries yet this month.",
    "goodbye": "Goodbye! Your ledger is saved.",
    "help": "Commands: add-income, add-expense, summary, quit",
    "unknown_command": "Unknown command. Type 'help'.",
    "saved": "Ledger saved.",
}


def t(key: str) -> str:
    return UI_STRINGS[key]


def main() -> None:
    print(t("welcome"))
    print(t("help"))
    # (Demo stub: the real CLI loop is irrelevant to the translation task.)


if __name__ == "__main__":
    main()
