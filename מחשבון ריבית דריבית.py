from flask import Flask, render_template, request
import matplotlib.pyplot as plt
import io
import base64

app = Flask(__name__)

@app.route("/", methods=["GET", "POST"])
def index():
    result = None
    chart = None

    if request.method == "POST":
        try:
            P = float(request.form['principal'])
            M = float(request.form['monthly'])
            r = float(request.form['rate']) / 100
            n = int(request.form['years'])
            months = n * 12
            balances = []
            total = P
            monthly_rate = r / 12
            for month in range(months):
                total = total * (1 + monthly_rate) + M
                balances.append(total)

            invested = P + M * months
            profit = total - invested
            yearly_profits = []
            for year in range(1, n + 1):
                month_index = year * 12 - 1
                amount = balances[month_index]
                invested_to_date = P + M * 12 * year
                yearly_profits.append(round(amount - invested_to_date, 2))

            fig, ax = plt.subplots()
            ax.plot(range(1, months + 1), balances)
            ax.set_title("התפתחות ההשקעה")
            ax.set_xlabel("חודש")
            ax.set_ylabel("ש\"ח")
            ax.grid(True)
            img = io.BytesIO()
            plt.savefig(img, format='png')
            img.seek(0)
            chart = base64.b64encode(img.read()).decode()

            result = {
                'final': round(total, 2),
                'invested': round(invested, 2),
                'profit': round(profit, 2),
                'yearly': yearly_profits
            }

        except Exception as e:
            result = {"error": str(e)}

    return render_template("index.html", result=result, chart=chart)

if __name__ == "__main__":
    app.run(debug=True)
