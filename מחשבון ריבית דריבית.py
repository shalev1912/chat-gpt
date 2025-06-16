<!DOCTYPE html>
<html lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>מחשבון ריבית דריבית</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      direction: rtl;
      background: url('https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?auto=format&fit=crop&w=1350&q=80') no-repeat center center fixed;
      background-size: cover;
      padding: 20px;
      text-align: center;
      color: #333;
    }
    .calculator {
      background: rgba(255, 255, 255, 0.95);
      padding: 25px;
      border-radius: 20px;
      display: inline-block;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      max-width: 400px;
    }
    input, button {
      margin: 10px 0;
      padding: 12px;
      width: 90%;
      font-size: 16px;
      border: 1px solid #ccc;
      border-radius: 8px;
    }
    button {
      background-color: #4a90e2;
      color: white;
      font-weight: bold;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    button:hover {
      background-color: #357ab8;
    }
    .result, .history {
      margin-top: 20px;
      font-size: 16px;
      text-align: right;
    }
    .history {
      background-color: #f7faff;
      border: 1px solid #cce0ff;
      border-radius: 10px;
      padding: 10px;
      max-height: 200px;
      overflow-y: auto;
    }
    .history-entry {
      border-bottom: 1px solid #eee;
      padding: 5px 0;
    }
  </style>
</head>
<body>
  <h1>מחשבון ריבית דריבית</h1>
  <div class="calculator">
    <label>סכום ראשוני (₪):</label>
    <input type="number" id="principal" placeholder="לדוגמה: 10000">

    <label>הפקדה חודשית קבועה (₪):</label>
    <input type="number" id="monthly" placeholder="לדוגמה: 500">

    <label>ריבית שנתית (%):</label>
    <input type="number" id="rate" placeholder="לדוגמה: 5">

    <label>שנים:</label>
    <input type="number" id="years" placeholder="לדוגמה: 10">

    <button onclick="calculateCompoundInterest()">חשב</button>
    <button onclick="clearHistory()" style="background:#aaa">נקה היסטוריה</button>

    <div class="result" id="output"></div>
    <div class="history" id="history"></div>
  </div>

  <script>
    function calculateCompoundInterest() {
      const P = parseFloat(document.getElementById('principal').value);
      const PMT = parseFloat(document.getElementById('monthly').value);
      const r = parseFloat(document.getElementById('rate').value) / 100;
      const n = 12; // חודשי
      const t = parseFloat(document.getElementById('years').value);

      if (isNaN(P) || isNaN(PMT) || isNaN(r) || isNaN(t)) {
        document.getElementById('output').textContent = 'נא למלא את כל השדות בצורה תקינה.';
        return;
      }

      const futureValuePrincipal = P * Math.pow(1 + r / n, n * t);
      const futureValueMonthly = PMT * ((Math.pow(1 + r / n, n * t) - 1) / (r / n));
      const total = futureValuePrincipal + futureValueMonthly;
      const totalInvested = P + PMT * t * 12;
      const interestEarned = total - totalInvested;

      const resultText =
        `סה"כ לאחר ${t} שנים: ₪${total.toFixed(2)}<br>` +
        `סך כל ההפקדות: ₪${totalInvested.toFixed(2)}<br>` +
        `רווח שהצטבר: ₪${interestEarned.toFixed(2)}`;

      document.getElementById('output').innerHTML = resultText;

      const historyEntry = document.createElement('div');
      historyEntry.className = 'history-entry';
      historyEntry.innerHTML = resultText;
      document.getElementById('history').prepend(historyEntry);
    }

    function clearHistory() {
      document.getElementById('history').innerHTML = '';
    }
  </script>
</body>
</html>

