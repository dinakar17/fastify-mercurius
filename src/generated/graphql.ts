import { GraphQLResolveInfo } from 'graphql';
import { DbAccount, InsertAccount, DbCategory, InsertCategory, DbCustomTransactionName, InsertCustomTransactionName, DbTransaction, InsertTransaction } from '../db/schema';
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
  transactions: Array<Transaction>;
  updatedAt: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
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

export type Category = {
  __typename?: 'Category';
  categoryId: Scalars['ID']['output'];
  categoryName: Scalars['String']['output'];
  categoryNumber: Scalars['Int']['output'];
  categoryType: CategoryType;
  createdAt: Scalars['String']['output'];
  iconUrl?: Maybe<Scalars['String']['output']>;
  investmentSector?: Maybe<Scalars['String']['output']>;
  transactions: Array<Transaction>;
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
  success: Scalars['Boolean']['output'];
  transactionId?: Maybe<Scalars['ID']['output']>;
};

export type GetTransactionsInput = {
  accountId?: InputMaybe<Array<Scalars['ID']['input']>>;
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  customNameId?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  month?: InputMaybe<Scalars['String']['input']>;
  order?: InputMaybe<TransactionOrderType>;
  type?: InputMaybe<TransactionFilterType>;
};

export type InvestmentAction =
  | 'BONUS'
  | 'BUY'
  | 'DIVIDEND'
  | 'SELL'
  | 'SPLIT';

export type Mutation = {
  __typename?: 'Mutation';
  createAccount: Account;
  createTransaction: Transaction;
  deleteAccount: DeleteResponse;
  deleteTransaction: DeleteResponse;
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


export type MutationUpdateAccountArgs = {
  accountId: Scalars['ID']['input'];
  input: UpdateAccountInput;
};


export type MutationUpdateTransactionArgs = {
  input: UpdateTransactionInput;
  transactionId: Scalars['ID']['input'];
};

export type Query = {
  __typename?: 'Query';
  getAccount: Account;
  getMyAccounts: Array<Account>;
  getMyTransaction: Transaction;
  getMyTransactions: Array<Transaction>;
};


export type QueryGetAccountArgs = {
  accountId: Scalars['ID']['input'];
};


export type QueryGetMyTransactionArgs = {
  transactionId: Scalars['ID']['input'];
};


export type QueryGetMyTransactionsArgs = {
  options?: InputMaybe<GetTransactionsInput>;
};

export type RecurringFrequency =
  | 'DAILY'
  | 'MONTHLY'
  | 'WEEKLY'
  | 'YEARLY';

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

export type UpdateTransactionInput = {
  amount?: InputMaybe<Scalars['String']['input']>;
  categoryNumber?: InputMaybe<Scalars['Int']['input']>;
  customName?: InputMaybe<Scalars['String']['input']>;
  customNameLogoUrl?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
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
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Category: ResolverTypeWrapper<Category>;
  CategoryType: CategoryType;
  CreateAccountInput: CreateAccountInput;
  CreateTransactionInput: CreateTransactionInput;
  CustomTransactionName: ResolverTypeWrapper<CustomTransactionName>;
  DeleteResponse: ResolverTypeWrapper<DeleteResponse>;
  GetTransactionsInput: GetTransactionsInput;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  InvestmentAction: InvestmentAction;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  RecurringFrequency: RecurringFrequency;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Transaction: ResolverTypeWrapper<Transaction>;
  TransactionFilterType: TransactionFilterType;
  TransactionOrderType: TransactionOrderType;
  TransactionType: TransactionType;
  UpdateAccountInput: UpdateAccountInput;
  UpdateTransactionInput: UpdateTransactionInput;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Account: Account;
  Boolean: Scalars['Boolean']['output'];
  Category: Category;
  CreateAccountInput: CreateAccountInput;
  CreateTransactionInput: CreateTransactionInput;
  CustomTransactionName: CustomTransactionName;
  DeleteResponse: DeleteResponse;
  GetTransactionsInput: GetTransactionsInput;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Mutation: Record<PropertyKey, never>;
  Query: Record<PropertyKey, never>;
  String: Scalars['String']['output'];
  Transaction: Transaction;
  UpdateAccountInput: UpdateAccountInput;
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
  transactions?: Resolver<Array<ResolversTypes['Transaction']>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
}>;

export type CategoryResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['Category'] = ResolversParentTypes['Category']> = ResolversObject<{
  categoryId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  categoryName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  categoryNumber?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  categoryType?: Resolver<ResolversTypes['CategoryType'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  iconUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  investmentSector?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  transactions?: Resolver<Array<ResolversTypes['Transaction']>, ParentType, ContextType>;
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
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  transactionId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  createAccount?: Resolver<ResolversTypes['Account'], ParentType, ContextType, RequireFields<MutationCreateAccountArgs, 'input'>>;
  createTransaction?: Resolver<ResolversTypes['Transaction'], ParentType, ContextType, RequireFields<MutationCreateTransactionArgs, 'input'>>;
  deleteAccount?: Resolver<ResolversTypes['DeleteResponse'], ParentType, ContextType, RequireFields<MutationDeleteAccountArgs, 'accountId'>>;
  deleteTransaction?: Resolver<ResolversTypes['DeleteResponse'], ParentType, ContextType, RequireFields<MutationDeleteTransactionArgs, 'transactionId'>>;
  updateAccount?: Resolver<ResolversTypes['Account'], ParentType, ContextType, RequireFields<MutationUpdateAccountArgs, 'accountId' | 'input'>>;
  updateTransaction?: Resolver<ResolversTypes['Transaction'], ParentType, ContextType, RequireFields<MutationUpdateTransactionArgs, 'input' | 'transactionId'>>;
}>;

export type QueryResolvers<ContextType = MercuriusContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  getAccount?: Resolver<ResolversTypes['Account'], ParentType, ContextType, RequireFields<QueryGetAccountArgs, 'accountId'>>;
  getMyAccounts?: Resolver<Array<ResolversTypes['Account']>, ParentType, ContextType>;
  getMyTransaction?: Resolver<ResolversTypes['Transaction'], ParentType, ContextType, RequireFields<QueryGetMyTransactionArgs, 'transactionId'>>;
  getMyTransactions?: Resolver<Array<ResolversTypes['Transaction']>, ParentType, ContextType, Partial<QueryGetMyTransactionsArgs>>;
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

export type Resolvers<ContextType = MercuriusContext> = ResolversObject<{
  Account?: AccountResolvers<ContextType>;
  Category?: CategoryResolvers<ContextType>;
  CustomTransactionName?: CustomTransactionNameResolvers<ContextType>;
  DeleteResponse?: DeleteResponseResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Transaction?: TransactionResolvers<ContextType>;
}>;

