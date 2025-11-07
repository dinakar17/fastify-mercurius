# Financial Insights AI Tool Documentation

## Overview

The `getFinancialInsights` tool enables users to analyze their financial data using natural language queries. It leverages the `getMyTotals` GraphQL query to provide flexible aggregation and filtering of transaction data.

## Features

### What Can Users Ask?

The tool can answer questions about:

1. **Spending Patterns**
   - "How much did I spend on food last month?"
   - "What's my total spending this year?"
   - "Show me my expenses in October"

2. **Income Analysis**
   - "What was my total income in 2024?"
   - "How much did I earn last quarter?"
   - "Show my monthly income for the last 6 months"

3. **Category Breakdowns**
   - "Show me my spending by category this year"
   - "What are my top 5 spending categories?"
   - "How much did I spend on transport?"

4. **Merchant Analysis**
   - "How much did I spend at Zomato?"
   - "Show me all my food delivery expenses"
   - "Which merchant did I spend the most on?"

5. **Time-Based Trends**
   - "Show my monthly spending for the last 6 months"
   - "What's my spending trend over time?"
   - "Compare my spending month by month"

6. **Account Comparisons**
   - "Compare spending across my accounts"
   - "How much did I spend from my HDFC account?"
   - "Show me account-wise breakdown"

7. **Investment Tracking**
   - "How much did I invest in stocks this quarter?"
   - "Show my investment activity this year"
   - "What's my total investment amount?"

## Tool Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | string | Start date in ISO 8601 format (YYYY-MM-DD) |
| `endDate` | string | End date in ISO 8601 format (YYYY-MM-DD) |

### Optional Parameters

| Parameter | Type | Options | Description |
|-----------|------|---------|-------------|
| `groupBy` | enum | `NONE`, `ACCOUNT`, `CATEGORY`, `CUSTOM_NAME` | How to split the data |
| `timeBucket` | enum | `NONE`, `MONTH` | How to bucket by time |
| `transactionType` | enum | `DEBIT`, `CREDIT` | Filter by transaction type |
| `accountIds` | array | User's account IDs | Filter by specific accounts |
| `categoryNumber` | number | Category numbers | Filter by specific category |
| `isInvestment` | boolean | true/false | Filter investment transactions |
| `isRecurring` | boolean | true/false | Filter recurring transactions |
| `limit` | number | Any positive integer | Limit results (with groupBy) |

## How It Works

### 1. Date Parsing

The AI intelligently parses natural language dates into ISO 8601 format:

| Natural Language | Parsed As |
|-----------------|-----------|
| "last month" | Previous calendar month (1st to last day) |
| "this month" | Current month (1st to today) |
| "this year" | Current year (Jan 1 to today) |
| "last 3 months" | 3 months ago to today |
| "Q1 2024" | Jan 1 2024 to Mar 31 2024 |
| "October 2024" | Oct 1 2024 to Oct 31 2024 |

### 2. Grouping and Bucketing

#### groupBy Options

- **NONE**: Returns single total for the entire period
  ```
  Example: "What's my total spending this year?"
  Result: Single total value
  ```

- **ACCOUNT**: Split by accounts
  ```
  Example: "Compare spending across accounts"
  Result: [{ account: "HDFC", total: "5000" }, { account: "SBI", total: "3000" }]
  ```

- **CATEGORY**: Split by categories
  ```
  Example: "Show spending by category"
  Result: [{ category: "Food", total: "2000" }, { category: "Transport", total: "1000" }]
  ```

- **CUSTOM_NAME**: Split by merchants/payees
  ```
  Example: "Show me where I spent money"
  Result: [{ merchant: "Zomato", total: "800" }, { merchant: "Uber", total: "500" }]
  ```

#### timeBucket Options

- **NONE**: Use the full date range
  ```
  Example: "Total spending from Jan to Dec"
  Result: Single period
  ```

- **MONTH**: Split into monthly buckets
  ```
  Example: "Monthly spending for last 6 months"
  Result: [
    { month: "2024-07", total: "5000" },
    { month: "2024-08", total: "6000" },
    ...
  ]
  ```

#### Combined Grouping

You can combine `groupBy` and `timeBucket` for multi-dimensional analysis:

```
Example: "Monthly spending by category for last 3 months"
Parameters:
  - groupBy: CATEGORY
  - timeBucket: MONTH
  - startDate: "2024-08-01"
  - endDate: "2024-10-31"

Result: [
  { category: "Food", month: "2024-08", total: "2000" },
  { category: "Transport", month: "2024-08", total: "1000" },
  { category: "Food", month: "2024-09", total: "2500" },
  { category: "Transport", month: "2024-09", total: "1200" },
  ...
]
```

### 3. Filtering

Apply filters to narrow down specific transaction types:

```typescript
// Spending only (exclude income)
transactionType: "DEBIT"

// Income only
transactionType: "CREDIT"

// Investment transactions only
isInvestment: true

// Regular expenses (exclude investments)
isInvestment: false

// Recurring payments only
isRecurring: true

// Specific category (e.g., Food & Dining)
categoryNumber: 1

// Specific accounts
accountIds: ["acc-123", "acc-456"]

// Top 5 results
limit: 5
```

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Breakdown by category (5 items). Total: ₹12,500.00",
  "results": [
    {
      "total": "₹5,000.00",
      "startDate": "2024-10-01",
      "endDate": "2024-10-31",
      "category": "Food & Dining",
      "categoryNumber": 1
    },
    {
      "total": "₹3,500.00",
      "startDate": "2024-10-01",
      "endDate": "2024-10-31",
      "category": "Transportation",
      "categoryNumber": 2
    }
  ],
  "total": "₹12,500.00",
  "count": 5,
  "period": {
    "startDate": "2024-10-01",
    "endDate": "2024-10-31"
  },
  "filters": {
    "transactionType": "DEBIT"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "startDate must be before or equal to endDate"
}
```

## Example Queries

### 1. Simple Total

**User**: "How much did I spend last month?"

**AI Processing**:
```typescript
{
  startDate: "2024-10-01",
  endDate: "2024-10-31",
  transactionType: "DEBIT",
  groupBy: "NONE",
  timeBucket: "NONE"
}
```

**Response**: "You spent ₹15,340.00 last month (October 2024)"

### 2. Category Breakdown

**User**: "Show me my top 5 spending categories this year"

**AI Processing**:
```typescript
{
  startDate: "2024-01-01",
  endDate: "2024-11-07",
  transactionType: "DEBIT",
  groupBy: "CATEGORY",
  timeBucket: "NONE",
  limit: 5
}
```

**Response**:
```
Here are your top 5 spending categories for 2024:

1. Food & Dining: ₹45,600.00
2. Transportation: ₹28,300.00
3. Shopping: ₹22,150.00
4. Entertainment: ₹15,800.00
5. Utilities: ₹12,400.00

Total across all categories: ₹124,250.00
```

### 3. Monthly Trend

**User**: "Show my monthly spending for the last 6 months"

**AI Processing**:
```typescript
{
  startDate: "2024-05-01",
  endDate: "2024-10-31",
  transactionType: "DEBIT",
  groupBy: "NONE",
  timeBucket: "MONTH"
}
```

**Response**:
```
Your monthly spending trend:

May 2024: ₹18,500.00
Jun 2024: ₹20,100.00
Jul 2024: ₹19,300.00
Aug 2024: ₹22,400.00
Sep 2024: ₹21,800.00
Oct 2024: ₹23,650.00

Total: ₹125,750.00
Average: ₹20,958.33/month
```

### 4. Multi-Dimensional Analysis

**User**: "Monthly spending by category for last 3 months"

**AI Processing**:
```typescript
{
  startDate: "2024-08-01",
  endDate: "2024-10-31",
  transactionType: "DEBIT",
  groupBy: "CATEGORY",
  timeBucket: "MONTH"
}
```

**Response**:
```
Your spending breakdown by category and month:

August 2024:
  - Food & Dining: ₹7,200.00
  - Transportation: ₹4,500.00
  - Shopping: ₹3,800.00

September 2024:
  - Food & Dining: ₹8,100.00
  - Transportation: ₹5,200.00
  - Shopping: ₹2,900.00

October 2024:
  - Food & Dining: ₹7,800.00
  - Transportation: ₹4,800.00
  - Shopping: ₹4,200.00

Total: ₹48,500.00
```

### 5. Merchant Analysis

**User**: "How much did I spend at Zomato in the last 3 months?"

**AI Processing**:
```typescript
{
  startDate: "2024-08-01",
  endDate: "2024-10-31",
  transactionType: "DEBIT",
  groupBy: "CUSTOM_NAME",
  timeBucket: "NONE"
}
```

**Response** (AI filters for Zomato):
```
You spent ₹4,850.00 at Zomato in the last 3 months.
```

### 6. Account Comparison

**User**: "Compare my spending across accounts this year"

**AI Processing**:
```typescript
{
  startDate: "2024-01-01",
  endDate: "2024-11-07",
  transactionType: "DEBIT",
  groupBy: "ACCOUNT",
  timeBucket: "NONE"
}
```

**Response**:
```
Your spending by account in 2024:

1. HDFC Savings: ₹85,400.00 (PREPAID - SAVINGS_ACCOUNT)
2. SBI Credit Card: ₹42,300.00 (POSTPAID - CREDIT_CARD)
3. Paytm Wallet: ₹18,650.00 (PREPAID - WALLET)

Total: ₹146,350.00
```

### 7. Investment Tracking

**User**: "How much did I invest in stocks this quarter?"

**AI Processing**:
```typescript
{
  startDate: "2024-10-01",
  endDate: "2024-12-31",
  transactionType: "DEBIT",
  isInvestment: true,
  groupBy: "NONE",
  timeBucket: "NONE"
}
```

**Response**: "You invested ₹50,000.00 in stocks this quarter (Q4 2024)"

## Implementation Details

### Architecture

```
User Query
    ↓
AI parses natural language
    ↓
Extracts parameters (dates, filters, grouping)
    ↓
Calls getFinancialInsightsTool
    ↓
Tool builds GetTotalsInput
    ↓
Calls insightQueries.getMyTotals resolver
    ↓
Executes database queries with aggregation
    ↓
Returns formatted results
    ↓
AI presents results conversationally
```

### Database Context

The tool automatically fetches and includes in its description:
- **User Accounts**: All active accounts with names and types
- **General Categories**: All expense/income categories
- **Investment Categories**: All investment-related categories

This context helps the AI:
- Match account names from user queries
- Choose appropriate categories
- Provide accurate category numbers
- Understand the user's financial setup

### Transfer Transaction Handling

The underlying `getMyTotals` query automatically excludes internal transfers (PREPAID→PREPAID, POSTPAID→PREPAID) but includes bill payments (PREPAID→POSTPAID) as legitimate expenses.

## Best Practices

### For Users

1. **Be specific about dates**: "last month" is clearer than "recently"
2. **Mention the analysis type**: "breakdown", "total", "trend"
3. **Specify filters when needed**: "spending on food" vs "total spending"

### For AI Implementation

1. **Always parse dates to ISO 8601 format**
2. **Use appropriate groupBy based on user intent**:
   - "by category" → `CATEGORY`
   - "by account" → `ACCOUNT`
   - "where I spent" → `CUSTOM_NAME`
3. **Use timeBucket: MONTH for trends and time-series analysis**
4. **Combine filters intelligently**:
   - "spending" → `transactionType: DEBIT`
   - "income" → `transactionType: CREDIT`
   - "investments" → `isInvestment: true`
5. **Format results clearly with currency symbols and readable structure**
6. **Provide context in responses** (percentages, trends, comparisons)

## Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid date format" | Non-ISO date string | Parse to YYYY-MM-DD format |
| "startDate must be before endDate" | Date range reversed | Swap dates or recalculate |
| "No transactions found" | No data for criteria | Suggest broader date range or different filters |
| "Not authenticated" | Missing user context | Ensure user is logged in |

## Future Enhancements

Potential improvements:
- Weekly and quarterly time buckets
- Percentage-based insights (% change, % of total)
- Budget vs actual comparisons
- Anomaly detection (unusual spending)
- Predictive insights (projected spending)
- Export capabilities (CSV, PDF)
- Visualization data formatting (chart-ready JSON)

## Testing Examples

### Test Case 1: Simple Total
```
Input: "How much did I spend in October?"
Expected: Single total value for October 2024, DEBIT transactions
```

### Test Case 2: Category Breakdown
```
Input: "Show me my spending by category this year"
Expected: Array of categories with totals, sorted by amount
```

### Test Case 3: Monthly Trend
```
Input: "Monthly income for last 6 months"
Expected: 6 monthly buckets with CREDIT transaction totals
```

### Test Case 4: Filtered Query
```
Input: "How much did I spend on food at restaurants in September?"
Expected: Total for food category in September 2024
```

### Test Case 5: Multi-Dimensional
```
Input: "Monthly spending by category for Q3 2024"
Expected: 3 months × N categories with totals for each combination
```

## Conclusion

The Financial Insights AI Tool provides a powerful, flexible way for users to analyze their financial data using natural language. By leveraging the `getMyTotals` query's aggregation capabilities and combining it with AI's natural language understanding, users can get instant answers to complex financial questions without writing SQL or GraphQL queries.
