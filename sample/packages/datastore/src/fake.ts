import type { DataStoreContext, TableName } from './context.js'
import {
  CHECKINS_MAIN_KEY,
  CHECKINS_SUB_KEY,
  SPOTS_MAIN_KEY,
  SPOTS_SUB_KEY,
  USERS_MAIN_KEY,
  USERS_SUB_KEY,
  USER_SPOT_STATE_MAIN_KEY,
  USER_SPOT_STATE_SUB_KEY,
} from './keys.js'
import type {
  DataStoreClient,
  DsDeleteParams,
  DsDeleteResult,
  DsGetParams,
  DsGetResult,
  DsPutParams,
  DsPutResult,
  DsQueryParams,
  DsQueryResult,
} from './types.js'

/**
 * インメモリのデータストア実装。
 *
 * データストアはローカルで代替できない（実行環境が接続情報を注入するため）。
 * そのため通しの導線確認は、この fake に差し替えた統合テストとローカル起動で行う。
 *
 * 本物の SDK に寄せている点:
 * - アイテムが無い getItem は **文字列** 'Not found' を throw する（Error ではない）
 * - query の order は true が降順
 */

export interface FakeTableSchema {
  mainKey: string
  subKey: string
}

export const FAKE_TABLE_SCHEMAS: Record<string, FakeTableSchema> = {
  'fake-spots': { mainKey: SPOTS_MAIN_KEY, subKey: SPOTS_SUB_KEY },
  'fake-users': { mainKey: USERS_MAIN_KEY, subKey: USERS_SUB_KEY },
  'fake-checkins': { mainKey: CHECKINS_MAIN_KEY, subKey: CHECKINS_SUB_KEY },
  'fake-user-spot-state': { mainKey: USER_SPOT_STATE_MAIN_KEY, subKey: USER_SPOT_STATE_SUB_KEY },
}

export const FAKE_TABLE_IDS: Record<TableName, string> = {
  spots: 'fake-spots',
  users: 'fake-users',
  checkins: 'fake-checkins',
  userSpotState: 'fake-user-spot-state',
}

type Item = Record<string, unknown>

type Comparator = '>=' | '<=' | '=' | '>' | '<'

interface ParsedExpression {
  mainName: string
  subCondition?: { name: string; comparator: Comparator }
}

function parseExpression(expression: string): ParsedExpression {
  const [mainPart, subPart, ...rest] = expression.split(/\s+AND\s+/i)
  if (mainPart === undefined || rest.length > 0) {
    throw new Error(`fake datastore: unsupported expression: ${expression}`)
  }

  const mainMatch = /^#(\w+)\s*=\s*:(\w+)$/.exec(mainPart.trim())
  const mainName = mainMatch?.[1]
  if (mainName === undefined || mainName !== mainMatch?.[2]) {
    throw new Error(`fake datastore: unsupported main key condition: ${mainPart}`)
  }

  if (subPart === undefined) return { mainName }

  const subMatch = /^#(\w+)\s*(>=|<=|=|>|<)\s*:(\w+)$/.exec(subPart.trim())
  const subName = subMatch?.[1]
  const comparator = subMatch?.[2]
  if (subName === undefined || comparator === undefined || subName !== subMatch?.[3]) {
    throw new Error(`fake datastore: unsupported sub key condition: ${subPart}`)
  }

  return {
    mainName,
    subCondition: { name: subName, comparator: comparator as Comparator },
  }
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function satisfies(value: unknown, comparator: Comparator, expected: unknown): boolean {
  const diff = compare(value, expected)
  switch (comparator) {
    case '=':
      return diff === 0
    case '>=':
      return diff >= 0
    case '<=':
      return diff <= 0
    case '>':
      return diff > 0
    case '<':
      return diff < 0
  }
}

export class FakeDataStoreClient implements DataStoreClient {
  private readonly tables = new Map<string, Item[]>()
  private readonly schemas: Record<string, FakeTableSchema>

  /** 呼び出し回数。データストアのアクセス回数上限（E4）を意識するためテストから確認できる */
  accessCount = 0

  constructor(schemas: Record<string, FakeTableSchema> = FAKE_TABLE_SCHEMAS) {
    this.schemas = schemas
  }

  private schemaOf(tableId: string): FakeTableSchema {
    const schema = this.schemas[tableId]
    // "not found" という文字列は使わない。runGet に吸収されると設定ミスが隠れるため。
    if (!schema) throw `unknown table id: ${tableId}`
    return schema
  }

  private rowsOf(tableId: string): Item[] {
    const existing = this.tables.get(tableId)
    if (existing) return existing
    const created: Item[] = []
    this.tables.set(tableId, created)
    return created
  }

  private indexOf(tableId: string, key: Record<string, unknown>): number {
    const schema = this.schemaOf(tableId)
    return this.rowsOf(tableId).findIndex(
      (row) => row[schema.mainKey] === key[schema.mainKey] && row[schema.subKey] === key[schema.subKey],
    )
  }

  getItem(params: DsGetParams): Promise<DsGetResult> {
    this.accessCount += 1
    const index = this.indexOf(params.tableId, params.key)
    // ★ 本物の SDK と同じく文字列を throw する
    if (index < 0) return Promise.reject('Not found')
    return Promise.resolve({ params: { Item: this.rowsOf(params.tableId)[index] } })
  }

  putItem(params: DsPutParams): Promise<DsPutResult> {
    this.accessCount += 1
    const schema = this.schemaOf(params.tableId)
    const item = { ...params.item }
    if (item[schema.mainKey] === undefined || item[schema.subKey] === undefined) {
      throw `missing key attributes for table ${params.tableId}`
    }
    const rows = this.rowsOf(params.tableId)
    const index = this.indexOf(params.tableId, item as Record<string, unknown>)
    if (index >= 0) rows[index] = item
    else rows.push(item)
    return Promise.resolve({ params: { Item: item } })
  }

  query(params: DsQueryParams): Promise<DsQueryResult> {
    this.accessCount += 1
    const schema = this.schemaOf(params.tableId)
    const parsed = parseExpression(params.expression)

    const mainValue = params.values[parsed.mainName]
    let rows = this.rowsOf(params.tableId).filter((row) => row[schema.mainKey] === mainValue)

    if (parsed.subCondition) {
      const expected = params.values[parsed.subCondition.name]
      const comparator = parsed.subCondition.comparator
      rows = rows.filter((row) => satisfies(row[schema.subKey], comparator, expected))
    }

    rows = [...rows].sort((a, b) => compare(a[schema.subKey], b[schema.subKey]))
    if (params.order === true) rows.reverse()
    if (params.limit !== undefined) rows = rows.slice(0, params.limit)

    return Promise.resolve({ params: { Items: rows, Count: rows.length } })
  }

  deleteItem(params: DsDeleteParams): Promise<DsDeleteResult> {
    this.accessCount += 1
    const index = this.indexOf(params.tableId, params.key)
    if (index < 0) return Promise.resolve({ params: { Item: null } })
    const [removed] = this.rowsOf(params.tableId).splice(index, 1)
    return Promise.resolve({ params: { Item: removed } })
  }

  /** テスト用: 現在の全アイテム */
  dump(tableId: string): Item[] {
    return [...this.rowsOf(tableId)]
  }
}

export interface FakeDataStore {
  ctx: DataStoreContext
  client: FakeDataStoreClient
}

/** 環境変数を経由せずテーブル ID を解決するテスト・ローカル用コンテキスト */
export function createFakeDataStore(): FakeDataStore {
  const client = new FakeDataStoreClient()
  const ctx: DataStoreContext = {
    client,
    tableId: (name) => FAKE_TABLE_IDS[name],
  }
  return { ctx, client }
}
