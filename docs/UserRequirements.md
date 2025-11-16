# User Requirements – Lombardi Logger

### 1. Consumer Requirements

## 1.1 Account & Balance

- The system shall allow students to view their current dining dollar balance.
- The system shall show the student’s starting balance for the semester.
- The system shall show the total amount spent so far in the current semester.

## 1.2 Spending Tracking

- The system shall track each transaction made by the student at Lombardi.
- The system shall calculate the student’s **average daily spending**.
- The system shall track each individual purchase and cover these important details:
  - Date and time of purchase
  - Item(s) purchased
  - Category (drink, dessert, restaurant, etc.)
  - Price and quantity

## 1.3 Predictions + Recommendations

- The system shall estimate and display the predicted date when the student’s balance will reach zero, based on their individual spending patterns.
- The system shall calculate and display a ideal daily spending amount to allow the student’s funds to last until the final day of the semester.
- The system shall account for closed days such as holidays when calculating the amount of days left in a semester.

## 1.4 Visualizations

- The system shall display graphs showing:
  - Daily spending over time.
  - Remaining balance.
  - Spending by category. (bar chart would be best for this)

## 1.5 Usability

- The interface shall be mobile friendly.
- Important information such as remaining balance and average amount spent per day must be shown on the primary page.

### 2. Staff Requirements

## 2.1 Trends

- The system shall allow staff to view data about:
  - Total spending per vendor.
  - Total spending per item.
  - Total spending per category.
- The system shall allow staff to view trends over time to see when specific items are popular and not popular.

## 2.2 Closed Days Management

- The system shall allow staff or admins to mark specific dates as closed days.
- Closed days shall be used in predictions so that the system removes those days as days that would normally exist.

### 3. System Requirements

- The system shall store students, accounts, transactions, items, vendors, categories, semesters, predictions, and closed days in a database based on the previously created ERD.
- The system shall be designed so that it could integrate into the existing Lombardi mobile ordering platform in the future.
- The system shall be able to update predictions as new transactions are made.
