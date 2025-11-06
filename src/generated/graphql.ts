import { GraphQLResolveInfo } from 'graphql';
import { MercuriusContext } from '../types';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type Account = {
  __typename?: 'Account';
  accountGroup: AccountGroup;
  accountId: Scalars['ID']['output'];
  accountName: Scalars['String']['output'];
  accountNumber?: Maybe<Scalars['String']['output']>;
  accountType: AccountType;
  balanceUpdatedAt: Scalars['String']['output'];
  billingCycleDay?: Maybe<Scalars['Int']['output']>;
  createdAt: Scalars['String']['output'];
  creditLimit?: Maybe<Scalars['String']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  currentBalance: Scalars['String']['output'];
  institutionName?: Maybe<Scalars['String']['output']>;
  interestRate?: Maybe<Scalars['String']['output']>;
  isActive: Scalars['Boolean']['output'];
  isDefault: Scalars['Boolean']['output'];
  lastTransactionDate?: Maybe<Scalars['String']['output']>;
  loanAmount?: Maybe<Scalars['String']['output']>;
  loanEndDate?: Maybe<Scalars['String']['output']>;
  loanStartDate?: Maybe<Scalars['String']['output']>;
  logoUrl?: Maybe<Scalars['String']['output']>;
  manualBalanceUpdatedAt: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
};

export type AccountGroup =
  | 'INVESTMENT'
  | 'LOAN'
  | 'POSTPAID'
  | 'PREPAID';

export type AccountType =
  | 'BNPL'
  | 'CASH'
  | 'CREDIT_CARD'
  | 'CURRENT_ACCOUNT'
  | 'FIXED_DEPOSIT'
  | 'LOAN_BORROWED'
  | 'LOAN_LENT'
  | 'SAVINGS_ACCOUNT'
  | 'TRADING_DEMAT'
  | 'WALLET';

export type AmountRangeInput = {
  max?: InputMaybe<Scalars['String']['input']>;
  min?: InputMaybe<Scalars['String']['input']>;
};

export type Category = {
  __typename?: 'Category';
  categoryId: Scalars['ID']['output'];
  categoryName: Scalars['String']['output'];
  categoryNumber: Scalars['Int']['output'];
  categoryType: CategoryType;
  createdAt: Scalars['String']['output'];
  iconUrl?: Maybe<Scalars['String']['output']>;
  investmentSector?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
};

export type CategoryType =
  | 'GENERAL'
  | 'INVESTMENT';

export type CreateAccountInput = {
  accountGroup: AccountGroup;
  accountName: Scalars['String']['input'];
  accountNumber?: InputMaybe<Scalars['String']['input']>;
  accountType: AccountType;
  creditLimit?: InputMaybe<Scalars['String']['input']>;
  initialBalance?: InputMaybe<Scalars['String']['input']>;
  institutionName?: InputMaybe<Scalars['String']['input']>;
  logoUrl?: InputMaybe<Scalars['String']['input']>;
};

export type CreateRecurringPatternInput = {
  accountId: Scalars['ID']['input'];
  amount: Scalars['String']['input'];
  categoryNumber: Scalars['Int']['input'];
  customName?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  endDate?: InputMaybe<Scalars['String']['input']>;
  frequency: RecurringFrequency;
  location?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  paymentMethod?: InputMaybe<Scalars['String']['input']>;
  startDate: Scalars['String']['input'];
  transactionType: TransactionType;
};

export type CreateTransactionInput = {
  accountId: Scalars['ID']['input'];
  amount: Scalars['String']['input'];
  assetSymbol?: InputMaybe<Scalars['String']['input']>;
  categoryNumber: Scalars['Int']['input'];
  customName?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  investmentAction?: InputMaybe<InvestmentAction>;
  isInvestment?: InputMaybe<Scalars['Boolean']['input']>;
  isRecurring?: InputMaybe<Scalars['Boolean']['input']>;
  isTransfer?: InputMaybe<Scalars['Boolean']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  otherAccountId?: InputMaybe<Scalars['ID']['input']>;
  paymentMethod?: InputMaybe<Scalars['String']['input']>;
  pricePerUnit?: InputMaybe<Scalars['String']['input']>;
  quantity?: InputMaybe<Scalars['String']['input']>;
  recurringFrequency?: InputMaybe<RecurringFrequency>;
  recurringPatternName?: InputMaybe<Scalars['String']['input']>;
  transactionDateTime: Scalars['String']['input'];
  transactionType: TransactionType;
};

export type CustomTransactionName = {
  __typename?: 'CustomTransactionName';
  createdAt: Scalars['String']['output'];
  customName: Scalars['String']['output'];
  customNameId: Scalars['ID']['output'];
  logoUrl?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type DeleteResponse = {
  __typename?: 'DeleteResponse';
  accountId?: Maybe<Scalars['ID']['output']>;
  patternId?: Maybe<Scalars['ID']['output']>;
  success: Scalars['Boolean']['output'];
  transactionId?: Maybe<Scalars['ID']['output']>;
};

export type GetPortfolioDistributionInput = {
  accountIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  categoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type GetRecurringPatternsInput = {
  accountId?: InputMaybe<Array<Scalars['ID']['input']>>;
  categoryNumber?: InputMaybe<Scalars['Int']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<RecurringPatternStatus>;
  transactionType?: InputMaybe<TransactionType>;
};

export type GetTotalsInput = {
  endDate: Scalars['String']['input'];
  filters?: InputMaybe<TotalsFilterInput>;
  groupBy?: InputMaybe<GroupByDimension>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  startDate: Scalars['String']['input'];
  timeBucket?: InputMaybe<TimeBucket>;
};

export type GetTransactionsInput = {
  accountId?: InputMaybe<Array<Scalars['ID']['input']>>;
  amountRange?: InputMaybe<AmountRangeInput>;
  assetSymbol?: InputMaybe<Scalars['String']['input']>;
  categoryNumber?: InputMaybe<Scalars['Int']['input']>;
  cursor?: InputMaybe<Scalars['String']['input']>;
  customNameId?: InputMaybe<Scalars['ID']['input']>;
  endDate?: InputMaybe<Scalars['String']['input']>;
  investmentAction?: InputMaybe<InvestmentAction>;
  investmentHoldingId?: InputMaybe<Scalars['ID']['input']>;
  isInvestment?: InputMaybe<Scalars['Boolean']['input']>;
  isRecurring?: InputMaybe<Scalars['Boolean']['input']>;
  isTransfer?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  month?: InputMaybe<Scalars['String']['input']>;
  order?: InputMaybe<TransactionOrderType>;
  paymentMethod?: InputMaybe<Scalars['String']['input']>;
  recurringFrequency?: InputMaybe<RecurringFrequency>;
  recurringPatternId?: InputMaybe<Scalars['ID']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<TransactionFilterType>;
};

export type GroupByDimension =
  | 'ACCOUNT'
  | 'CATEGORY'
  | 'CUSTOM_NAME'
  | 'NONE';

export type InvestmentAction =
  | 'BONUS'
  | 'BUY'
  | 'DIVIDEND'
  | 'SELL'
  | 'SPLIT';

export type InvestmentHolding = {
  __typename?: 'InvestmentHolding';
  account: Account;
  accountId: Scalars['ID']['output'];
  assetName?: Maybe<Scalars['String']['output']>;
  assetSymbol: Scalars['String']['output'];
  averageBuyPrice?: Maybe<Scalars['String']['output']>;
  category: Category;
  categoryId: Scalars['ID']['output'];
  createdAt: Scalars['String']['output'];
  currency?: Maybe<Scalars['String']['output']>;
  holdingId: Scalars['ID']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  realizedGainLoss?: Maybe<Scalars['String']['output']>;
  sector?: Maybe<Scalars['String']['output']>;
  totalInvestedAmount: Scalars['String']['output'];
  totalQuantity: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type MonthlyRecurringPatternsResponse = {
  __typename?: 'MonthlyRecurringPatternsResponse';
  patterns: Array<RecurringPattern>;
  summary: MonthlyRecurringSummary;
};

export type MonthlyRecurringSummary = {
  __typename?: 'MonthlyRecurringSummary';
  dueToday: Scalars['Int']['output'];
  overdue: Scalars['Int']['output'];
  paid: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
  upcoming: Scalars['Int']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  createAccount: Account;
  createTransaction: Transaction;
  deleteAccount: DeleteResponse;
  deleteTransaction: DeleteResponse;
  manageRecurringPattern?: Maybe<RecurringPattern>;
  updateAccount: Account;
  updateTransaction: Transaction;
};


export type MutationCreateAccountArgs = {
  input: CreateAccountInput;
};


export type MutationCreateTransactionArgs = {
  input: CreateTransactionInput;
};


export type MutationDeleteAccountArgs = {
  accountId: Scalars['ID']['input'];
};


export type MutationDeleteTransactionArgs = {
  transactionId: Scalars['ID']['input'];
};


export type MutationManageRecurringPatternArgs = {
  action: Scalars['String']['input'];
  input?: InputMaybe<CreateRecurringPatternInput>;
  patternId?: InputMaybe<Scalars['ID']['input']>;
  updateInput?: InputMaybe<UpdateRecurringPatternInput>;
};


export type MutationUpdateAccountArgs = {
  accountId: Scalars['ID']['input'];
  input: UpdateAccountInput;
};


export type MutationUpdateTransactionArgs = {
  input: UpdateTransactionInput;
  transactionId: Scalars['ID']['input'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
};

export type PortfolioDistributionItem = {
  __typename?: 'PortfolioDistributionItem';
  category: Category;
  categoryId: Scalars['ID']['output'];
  categoryName: Scalars['String']['output'];
  holdingsCount: Scalars['Int']['output'];
  investmentSector?: Maybe<Scalars['String']['output']>;
  totalCurrentValue?: Maybe<Scalars['String']['output']>;
  totalInvestedAmount: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  getAccount: Account;
  getMonthlyRecurringPatterns: MonthlyRecurringPatternsResponse;
  getMyAccounts: Array<Account>;
  getMyInvestmentHoldings: Array<InvestmentHolding>;
  getMyPortfolioDistribution: Array<PortfolioDistributionItem>;
  getMyRecurringPatterns: RecurringPatternResponse;
  getMyTotals: Array<TotalResult>;
  getMyTransaction: Transaction;
  getMyTransactions: TransactionConnection;
  getRecurringPattern: RecurringPattern;
};


export type QueryGetAccountArgs = {
  accountId: Scalars['ID']['input'];
};


export type QueryGetMonthlyRecurringPatternsArgs = {
  month: Scalars['Int']['input'];
  year: Scalars['Int']['input'];
};


export type QueryGetMyInvestmentHoldingsArgs = {
  accountId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryGetMyPortfolioDistributionArgs = {
  input?: InputMaybe<GetPortfolioDistributionInput>;
};


export type QueryGetMyRecurringPatternsArgs = {
  input?: InputMaybe<GetRecurringPatternsInput>;
};


export type QueryGetMyTotalsArgs = {
  input: GetTotalsInput;
};


export type QueryGetMyTransactionArgs = {
  transactionId: Scalars['ID']['input'];
};


export type QueryGetMyTransactionsArgs = {
  options?: InputMaybe<GetTransactionsInput>;
};


export type QueryGetRecurringPatternArgs = {
  patternId: Scalars['ID']['input'];
};

export type RecurringFrequency =
  | 'DAILY'
  | 'MONTHLY'
  | 'WEEKLY'
  | 'YEARLY';

export type RecurringPattern = {
  __typename?: 'RecurringPattern';
  account: Account;
  accountId: Scalars['ID']['output'];
  amount: Scalars['String']['output'];
  category: Category;
  categoryId: Scalars['ID']['output'];
  createdAt: Scalars['String']['output'];
  customName?: Maybe<CustomTransactionName>;
  customNameId?: Maybe<Scalars['ID']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  endDate?: Maybe<Scalars['String']['output']>;
  frequency: RecurringFrequency;
  generatedCount: Scalars['Int']['output'];
  isActive: Scalars['Boolean']['output'];
  isPaused: Scalars['Boolean']['output'];
  lastGeneratedDate?: Maybe<Scalars['String']['output']>;
  location?: Maybe<Scalars['String']['output']>;
  nextDueDate: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  patternId: Scalars['ID']['output'];
  paymentMethod?: Maybe<Scalars['String']['output']>;
  skippedCount: Scalars['Int']['output'];
  startDate: Scalars['String']['output'];
  status: RecurringPatternStatus;
  transactionType: TransactionType;
  updatedAt: Scalars['String']['output'];
};

export type RecurringPatternResponse = {
  __typename?: 'RecurringPatternResponse';
  patterns: Array<RecurringPattern>;
  summary: RecurringPatternSummary;
  totalCount: Scalars['Int']['output'];
};

export type RecurringPatternStatus =
  | 'ALL'
  | 'OVERDUE'
  | 'PAID'
  | 'UPCOMING';

export type RecurringPatternSummary = {
  __typename?: 'RecurringPatternSummary';
  dueToday: Scalars['String']['output'];
  overdue: Scalars['String']['output'];
  paid: Scalars['String']['output'];
  total: Scalars['String']['output'];
  upcoming: Scalars['String']['output'];
};

export type TimeBucket =
  | 'MONTH'
  | 'NONE';

export type TotalMetadata = {
  __typename?: 'TotalMetadata';
  account?: Maybe<Account>;
  category?: Maybe<Category>;
  customName?: Maybe<CustomTransactionName>;
  month?: Maybe<Scalars['String']['output']>;
};

export type TotalResult = {
  __typename?: 'TotalResult';
  endDate: Scalars['String']['output'];
  filters?: Maybe<TotalsFilter>;
  metadata?: Maybe<TotalMetadata>;
  startDate: Scalars['String']['output'];
  total: Scalars['String']['output'];
};

export type TotalsFilter = {
  __typename?: 'TotalsFilter';
  accountIds?: Maybe<Array<Scalars['ID']['output']>>;
  categoryId?: Maybe<Scalars['ID']['output']>;
  categoryNumber?: Maybe<Scalars['Int']['output']>;
  customNameId?: Maybe<Scalars['ID']['output']>;
  isInvestment?: Maybe<Scalars['Boolean']['output']>;
  isRecurring?: Maybe<Scalars['Boolean']['output']>;
  transactionType?: Maybe<TransactionType>;
};

export type TotalsFilterInput = {
  accountIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  categoryNumber?: InputMaybe<Scalars['Int']['input']>;
  customNameId?: InputMaybe<Scalars['ID']['input']>;
  isInvestment?: InputMaybe<Scalars['Boolean']['input']>;
  isRecurring?: InputMaybe<Scalars['Boolean']['input']>;
  transactionType?: InputMaybe<TransactionType>;
};

export type Transaction = {
  __typename?: 'Transaction';
  account: Account;
  accountId: Scalars['ID']['output'];
  accountLogoUrl?: Maybe<Scalars['String']['output']>;
  accountName?: Maybe<Scalars['String']['output']>;
  accountNumber?: Maybe<Scalars['String']['output']>;
  amount: Scalars['String']['output'];
  assetSymbol?: Maybe<Scalars['String']['output']>;
  attachments?: Maybe<Scalars['String']['output']>;
  category?: Maybe<Category>;
  categoryIconUrl?: Maybe<Scalars['String']['output']>;
  categoryId?: Maybe<Scalars['ID']['output']>;
  categoryName?: Maybe<Scalars['String']['output']>;
  categoryNumber?: Maybe<Scalars['Int']['output']>;
  categoryType?: Maybe<CategoryType>;
  createdAt: Scalars['String']['output'];
  currency?: Maybe<Scalars['String']['output']>;
  customLogoUrl?: Maybe<Scalars['String']['output']>;
  customName?: Maybe<CustomTransactionName>;
  customNameId?: Maybe<Scalars['ID']['output']>;
  customNameText?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  feesCharges?: Maybe<Scalars['String']['output']>;
  investmentAction?: Maybe<InvestmentAction>;
  investmentSector?: Maybe<Scalars['String']['output']>;
  isInvestment: Scalars['Boolean']['output'];
  isRecurring: Scalars['Boolean']['output'];
  isTransfer: Scalars['Boolean']['output'];
  linkedTransaction?: Maybe<Transaction>;
  linkedTransactionId?: Maybe<Scalars['ID']['output']>;
  location?: Maybe<Scalars['String']['output']>;
  paymentMethod?: Maybe<Scalars['String']['output']>;
  pricePerUnit?: Maybe<Scalars['String']['output']>;
  quantity?: Maybe<Scalars['String']['output']>;
  recurringFrequency?: Maybe<RecurringFrequency>;
  recurringPatternName?: Maybe<Scalars['String']['output']>;
  transactionDateTime: Scalars['String']['output'];
  transactionId: Scalars['ID']['output'];
  transactionType: TransactionType;
  updatedAt: Scalars['String']['output'];
};

export type TransactionConnection = {
  __typename?: 'TransactionConnection';
  pageInfo: PageInfo;
  transactions: Array<Transaction>;
};

export type TransactionFilterType =
  | 'credit'
  | 'debit'
  | 'investment'
  | 'recurring'
  | 'transfer';

export type TransactionOrderType =
  | 'high_to_low'
  | 'low_to_high'
  | 'new_to_old'
  | 'old_to_new';

export type TransactionType =
  | 'CREDIT'
  | 'DEBIT';

export type UpdateAccountInput = {
  accountName?: InputMaybe<Scalars['String']['input']>;
  accountNumber?: InputMaybe<Scalars['String']['input']>;
  currentBalance?: InputMaybe<Scalars['String']['input']>;
  institutionName?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  logoUrl?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateRecurringPatternInput = {
  amount?: InputMaybe<Scalars['String']['input']>;
  categoryNumber?: InputMaybe<Scalars['Int']['input']>;
  customName?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  endDate?: InputMaybe<Scalars['String']['input']>;
  frequency?: InputMaybe<RecurringFrequency>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isPaused?: InputMaybe<Scalars['Boolean']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  paymentMethod?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
  transactionType?: InputMaybe<TransactionType>;
};

export type UpdateTransactionInput = {
  amount?: InputMaybe<Scalars['String']['input']>;
  assetSymbol?: InputMaybe<Scalars['String']['input']>;
  categoryNumber?: InputMaybe<Scalars['Int']['input']>;
  customName?: InputMaybe<Scalars['String']['input']>;
  customNameLogoUrl?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  investmentAction?: InputMaybe<InvestmentAction>;
  isInvestment?: InputMaybe<Scalars['Boolean']['input']>;
  isRecurring?: InputMaybe<Scalars['Boolean']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  paymentMethod?: InputMaybe<Scalars['String']['input']>;
  pricePerUnit?: InputMaybe<Scalars['String']['input']>;
  quantity?: InputMaybe<Scalars['String']['input']>;
  recurringFrequency?: InputMaybe<RecurringFrequency>;
  recurringPatternName?: InputMaybe<Scalars['String']['input']>;
  transactionDateTime?: InputMaybe<Scalars['String']['input']>;
  transactionType?: InputMaybe<TransactionType>;
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Account: ResolverTypeWrapper<Account>;
  AccountGroup: AccountGroup;
  AccountType: AccountType;
  AmountRangeInput: AmountRangeInput;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Category: ResolverTypeWrapper<Category>;
  CategoryType: CategoryType;
  CreateAccountInput: CreateAccountInput;
  CreateRecurringPatternInput: CreateRecurringPatternInput;
  CreateTransactionInput: CreateTransactionInput;
  CustomTransactionName: ResolverTypeWrapper<CustomTransactionName>;
  DeleteResponse: ResolverTypeWrapper<DeleteResponse>;
  GetPortfolioDistributionInput: GetPortfolioDistributionInput;
  GetRecurringPatternsInput: GetRecurringPatternsInput;
  GetTotalsInput: GetTotalsInput;
  GetTransactionsInput: GetTransactionsInput;
  GroupByDimension: GroupByDimension;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  InvestmentAction: InvestmentAction;
  InvestmentHolding: ResolverTypeWrapper<InvestmentHolding>;
  MonthlyRecurringPatternsResponse: ResolverTypeWrapper<MonthlyRecurringPatternsResponse>;
  MonthlyRecurringSummary: ResolverTypeWrapper<MonthlyRecurringSummary>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  PortfolioDistributionItem: ResolverTypeWrapper<PortfolioDistributionItem>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  RecurringFrequency: RecurringFrequency;
  RecurringPattern: ResolverTypeWrapper<RecurringPattern>;
  RecurringPatternResponse: ResolverTypeWrapper<RecurringPatternResponse>;
  RecurringPatternStatus: RecurringPatternStatus;
  RecurringPatternSummary: ResolverTypeWrapper<RecurringPatternSummary>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  TimeBucket: TimeBucket;
  TotalMetadata: ResolverTypeWrapper<TotalMetadata>;
  TotalResult: ResolverTypeWrapper<TotalResult>;
  TotalsFilter: ResolverTypeWrapper<TotalsFilter>;
  TotalsFilterInput: TotalsFilterInput;
  Transaction: ResolverTypeWrapper<Transaction>;
  TransactionConnection: ResolverTypeWrapper<TransactionConnection>;
  TransactionFilterType: TransactionFilterType;
  TransactionOrderType: TransactionOrderType;
  TransactionType: TransactionType;
  UpdateAccountInput: UpdateAccountInput;
  UpdateRecurringPatternInput: UpdateRecurringPatternInput;
  UpdateTransactionInput: UpdateTransactionInput;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Account: Account;
  AmountRangeInput: AmountRangeInput;
  Boolean: Scalars['Boolean']['output'];
  Category: Category;
  CreateAccountInput: CreateAccountInput;
  CreateRecurringPatternInput: CreateRecurringPatternInput;
  CreateTransactionInput: CreateTransactionInput;
  CustomTransactionName: CustomTransactionName;
  DeleteResponse: DeleteResponse;
  GetPortfolioDistributionInput: GetPortfolioDistributionInput;
  GetRecurringPatternsInput: GetRecurringPatternsInput;
  GetTotalsInput: GetTotalsInput;
  GetTransactionsInput: GetTransactionsInput;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  InvestmentHolding: InvestmentHolding;
  MonthlyRecurringPatternsResponse: MonthlyRecurringPatternsResponse;
  MonthlyRecurringSummary: MonthlyRecurringSummary;
  Mutation: Record<PropertyKey, never>;
  PageInfo: PageInfo;
  PortfolioDistributionItem: PortfolioDistributionItem;
  Query: Record<PropertyKey, never>;
  RecurringPattern: RecurringPattern;
  RecurringPatternResponse: RecurringPatternResponse;
  RecurringPatternSummary: RecurringPatternSummary;
  String: Scalars['String']['output'];
  TotalMetadata: TotalMetadata;
  TotalResult: TotalResult;
  TotalsFilter: TotalsFilter;
  TotalsFilterInput: TotalsFilterInput;
  Transaction: Transaction;
  TransactionConnection: TransactionConnection;
  UpdateAccountInput: UpdateAccountInput;
  UpdateRecurringPatternInput: UpdateRecurringPatternInput;
  UpdateTransactionInput: UpdateTransactionInput;
}>;

export type AccountResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['Account'] = ResolversParentTypes['Account']> = ResolversObject<{
  accountGroup?: Resolver<ResolversTypes['AccountGroup'], ParentType, ContextType>;
  accountId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  accountName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  accountNumber?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  accountType?: Resolver<ResolversTypes['AccountType'], ParentType, ContextType>;
  balanceUpdatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  billingCycleDay?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  creditLimit?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  currency?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  currentBalance?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  institutionName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  interestRate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDefault?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  lastTransactionDate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  loanAmount?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  loanEndDate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  loanStartDate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  logoUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  manualBalanceUpdatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  notes?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type CategoryResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['Category'] = ResolversParentTypes['Category']> = ResolversObject<{
  categoryId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  categoryName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  categoryNumber?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  categoryType?: Resolver<ResolversTypes['CategoryType'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  iconUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  investmentSector?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type CustomTransactionNameResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['CustomTransactionName'] = ResolversParentTypes['CustomTransactionName']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  customName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  customNameId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  logoUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
}>;

export type DeleteResponseResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['DeleteResponse'] = ResolversParentTypes['DeleteResponse']> = ResolversObject<{
  accountId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  patternId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  transactionId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
}>;

export type InvestmentHoldingResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['InvestmentHolding'] = ResolversParentTypes['InvestmentHolding']> = ResolversObject<{
  account?: Resolver<ResolversTypes['Account'], ParentType, ContextType>;
  accountId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  assetName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  assetSymbol?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  averageBuyPrice?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  category?: Resolver<ResolversTypes['Category'], ParentType, ContextType>;
  categoryId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  currency?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  holdingId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  notes?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  realizedGainLoss?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  sector?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  totalInvestedAmount?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  totalQuantity?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type MonthlyRecurringPatternsResponseResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['MonthlyRecurringPatternsResponse'] = ResolversParentTypes['MonthlyRecurringPatternsResponse']> = ResolversObject<{
  patterns?: Resolver<Array<ResolversTypes['RecurringPattern']>, ParentType, ContextType>;
  summary?: Resolver<ResolversTypes['MonthlyRecurringSummary'], ParentType, ContextType>;
}>;

export type MonthlyRecurringSummaryResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['MonthlyRecurringSummary'] = ResolversParentTypes['MonthlyRecurringSummary']> = ResolversObject<{
  dueToday?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  overdue?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  paid?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  upcoming?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  createAccount?: Resolver<ResolversTypes['Account'], ParentType, ContextType, RequireFields<MutationCreateAccountArgs, 'input'>>;
  createTransaction?: Resolver<ResolversTypes['Transaction'], ParentType, ContextType, RequireFields<MutationCreateTransactionArgs, 'input'>>;
  deleteAccount?: Resolver<ResolversTypes['DeleteResponse'], ParentType, ContextType, RequireFields<MutationDeleteAccountArgs, 'accountId'>>;
  deleteTransaction?: Resolver<ResolversTypes['DeleteResponse'], ParentType, ContextType, RequireFields<MutationDeleteTransactionArgs, 'transactionId'>>;
  manageRecurringPattern?: Resolver<Maybe<ResolversTypes['RecurringPattern']>, ParentType, ContextType, RequireFields<MutationManageRecurringPatternArgs, 'action'>>;
  updateAccount?: Resolver<ResolversTypes['Account'], ParentType, ContextType, RequireFields<MutationUpdateAccountArgs, 'accountId' | 'input'>>;
  updateTransaction?: Resolver<ResolversTypes['Transaction'], ParentType, ContextType, RequireFields<MutationUpdateTransactionArgs, 'input' | 'transactionId'>>;
}>;

export type PageInfoResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = ResolversObject<{
  endCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
}>;

export type PortfolioDistributionItemResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['PortfolioDistributionItem'] = ResolversParentTypes['PortfolioDistributionItem']> = ResolversObject<{
  category?: Resolver<ResolversTypes['Category'], ParentType, ContextType>;
  categoryId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  categoryName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  holdingsCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  investmentSector?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  totalCurrentValue?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  totalInvestedAmount?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  getAccount?: Resolver<ResolversTypes['Account'], ParentType, ContextType, RequireFields<QueryGetAccountArgs, 'accountId'>>;
  getMonthlyRecurringPatterns?: Resolver<ResolversTypes['MonthlyRecurringPatternsResponse'], ParentType, ContextType, RequireFields<QueryGetMonthlyRecurringPatternsArgs, 'month' | 'year'>>;
  getMyAccounts?: Resolver<Array<ResolversTypes['Account']>, ParentType, ContextType>;
  getMyInvestmentHoldings?: Resolver<Array<ResolversTypes['InvestmentHolding']>, ParentType, ContextType, Partial<QueryGetMyInvestmentHoldingsArgs>>;
  getMyPortfolioDistribution?: Resolver<Array<ResolversTypes['PortfolioDistributionItem']>, ParentType, ContextType, Partial<QueryGetMyPortfolioDistributionArgs>>;
  getMyRecurringPatterns?: Resolver<ResolversTypes['RecurringPatternResponse'], ParentType, ContextType, Partial<QueryGetMyRecurringPatternsArgs>>;
  getMyTotals?: Resolver<Array<ResolversTypes['TotalResult']>, ParentType, ContextType, RequireFields<QueryGetMyTotalsArgs, 'input'>>;
  getMyTransaction?: Resolver<ResolversTypes['Transaction'], ParentType, ContextType, RequireFields<QueryGetMyTransactionArgs, 'transactionId'>>;
  getMyTransactions?: Resolver<ResolversTypes['TransactionConnection'], ParentType, ContextType, Partial<QueryGetMyTransactionsArgs>>;
  getRecurringPattern?: Resolver<ResolversTypes['RecurringPattern'], ParentType, ContextType, RequireFields<QueryGetRecurringPatternArgs, 'patternId'>>;
}>;

export type RecurringPatternResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['RecurringPattern'] = ResolversParentTypes['RecurringPattern']> = ResolversObject<{
  account?: Resolver<ResolversTypes['Account'], ParentType, ContextType>;
  accountId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  amount?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  category?: Resolver<ResolversTypes['Category'], ParentType, ContextType>;
  categoryId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  customName?: Resolver<Maybe<ResolversTypes['CustomTransactionName']>, ParentType, ContextType>;
  customNameId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  endDate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  frequency?: Resolver<ResolversTypes['RecurringFrequency'], ParentType, ContextType>;
  generatedCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isPaused?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  lastGeneratedDate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  location?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  nextDueDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  notes?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  patternId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  paymentMethod?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  skippedCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  startDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['RecurringPatternStatus'], ParentType, ContextType>;
  transactionType?: Resolver<ResolversTypes['TransactionType'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type RecurringPatternResponseResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['RecurringPatternResponse'] = ResolversParentTypes['RecurringPatternResponse']> = ResolversObject<{
  patterns?: Resolver<Array<ResolversTypes['RecurringPattern']>, ParentType, ContextType>;
  summary?: Resolver<ResolversTypes['RecurringPatternSummary'], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type RecurringPatternSummaryResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['RecurringPatternSummary'] = ResolversParentTypes['RecurringPatternSummary']> = ResolversObject<{
  dueToday?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  overdue?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  paid?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  upcoming?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type TotalMetadataResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['TotalMetadata'] = ResolversParentTypes['TotalMetadata']> = ResolversObject<{
  account?: Resolver<Maybe<ResolversTypes['Account']>, ParentType, ContextType>;
  category?: Resolver<Maybe<ResolversTypes['Category']>, ParentType, ContextType>;
  customName?: Resolver<Maybe<ResolversTypes['CustomTransactionName']>, ParentType, ContextType>;
  month?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type TotalResultResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['TotalResult'] = ResolversParentTypes['TotalResult']> = ResolversObject<{
  endDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  filters?: Resolver<Maybe<ResolversTypes['TotalsFilter']>, ParentType, ContextType>;
  metadata?: Resolver<Maybe<ResolversTypes['TotalMetadata']>, ParentType, ContextType>;
  startDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type TotalsFilterResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['TotalsFilter'] = ResolversParentTypes['TotalsFilter']> = ResolversObject<{
  accountIds?: Resolver<Maybe<Array<ResolversTypes['ID']>>, ParentType, ContextType>;
  categoryId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  categoryNumber?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  customNameId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  isInvestment?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  isRecurring?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  transactionType?: Resolver<Maybe<ResolversTypes['TransactionType']>, ParentType, ContextType>;
}>;

export type TransactionResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['Transaction'] = ResolversParentTypes['Transaction']> = ResolversObject<{
  account?: Resolver<ResolversTypes['Account'], ParentType, ContextType>;
  accountId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  accountLogoUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  accountName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  accountNumber?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  amount?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  assetSymbol?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  attachments?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  category?: Resolver<Maybe<ResolversTypes['Category']>, ParentType, ContextType>;
  categoryIconUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  categoryId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  categoryName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  categoryNumber?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  categoryType?: Resolver<Maybe<ResolversTypes['CategoryType']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  currency?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  customLogoUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  customName?: Resolver<Maybe<ResolversTypes['CustomTransactionName']>, ParentType, ContextType>;
  customNameId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  customNameText?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  feesCharges?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  investmentAction?: Resolver<Maybe<ResolversTypes['InvestmentAction']>, ParentType, ContextType>;
  investmentSector?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  isInvestment?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isRecurring?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isTransfer?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  linkedTransaction?: Resolver<Maybe<ResolversTypes['Transaction']>, ParentType, ContextType>;
  linkedTransactionId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  location?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  paymentMethod?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  pricePerUnit?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  quantity?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  recurringFrequency?: Resolver<Maybe<ResolversTypes['RecurringFrequency']>, ParentType, ContextType>;
  recurringPatternName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  transactionDateTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  transactionId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  transactionType?: Resolver<ResolversTypes['TransactionType'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type TransactionConnectionResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['TransactionConnection'] = ResolversParentTypes['TransactionConnection']> = ResolversObject<{
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  transactions?: Resolver<Array<ResolversTypes['Transaction']>, ParentType, ContextType>;
}>;

export type Resolvers<ContextType = MercuriusContext> = ResolversObject<{
  Account?: AccountResolvers<ContextType>;
  Category?: CategoryResolvers<ContextType>;
  CustomTransactionName?: CustomTransactionNameResolvers<ContextType>;
  DeleteResponse?: DeleteResponseResolvers<ContextType>;
  InvestmentHolding?: InvestmentHoldingResolvers<ContextType>;
  MonthlyRecurringPatternsResponse?: MonthlyRecurringPatternsResponseResolvers<ContextType>;
  MonthlyRecurringSummary?: MonthlyRecurringSummaryResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  PortfolioDistributionItem?: PortfolioDistributionItemResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RecurringPattern?: RecurringPatternResolvers<ContextType>;
  RecurringPatternResponse?: RecurringPatternResponseResolvers<ContextType>;
  RecurringPatternSummary?: RecurringPatternSummaryResolvers<ContextType>;
  TotalMetadata?: TotalMetadataResolvers<ContextType>;
  TotalResult?: TotalResultResolvers<ContextType>;
  TotalsFilter?: TotalsFilterResolvers<ContextType>;
  Transaction?: TransactionResolvers<ContextType>;
  TransactionConnection?: TransactionConnectionResolvers<ContextType>;
}>;

