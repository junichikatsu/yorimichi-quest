/**
 * enebular データストアのうち、このアプリが使う操作だけに絞ったインターフェース。
 *
 * SDK の CloudDataStoreClient を直接持ち回らないことで、
 * テストからインメモリ実装（FakeDataStoreClient）へ差し替えられる。
 */

export type DataStoreValue = string | number | boolean | null | undefined

export type DataStoreKey = Record<string, string | number>

export interface DsGetParams {
  tableId: string
  key: DataStoreKey
}

export interface DsGetResult {
  params?: { Item?: unknown }
}

export interface DsPutParams {
  tableId: string
  item: Record<string, unknown>
}

export interface DsPutResult {
  params?: { Item?: unknown }
}

export interface DsQueryParams {
  tableId: string
  /** DynamoDB 互換の式。例: '#userKey = :userKey' */
  expression: string
  /** 式のプレースホルダに入る値。キーは # / : を除いた名前 */
  values: Record<string, string | number>
  limit?: number
  /** SDK 定義: false=昇順 / true=降順。ここを取り違えると「新しい順」が逆になる */
  order?: boolean
}

export interface DsQueryResult {
  params?: { Items?: unknown[]; Count?: number }
}

export interface DsDeleteParams {
  tableId: string
  key: DataStoreKey
}

export interface DsDeleteResult {
  params?: { Item?: unknown }
}

export interface DataStoreClient {
  getItem(params: DsGetParams): Promise<DsGetResult>
  putItem(params: DsPutParams): Promise<DsPutResult>
  query(params: DsQueryParams): Promise<DsQueryResult>
  deleteItem(params: DsDeleteParams): Promise<DsDeleteResult>
}

export type DataStoreOperation = 'getItem' | 'putItem' | 'query' | 'deleteItem'
