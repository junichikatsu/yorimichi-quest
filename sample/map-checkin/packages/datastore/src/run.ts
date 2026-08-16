import { classifyDataStoreError, isNotFoundError } from './errors.js'
import type { DataStoreOperation } from './types.js'

/** getItem 以外の操作。失敗はすべて DataStoreError に正規化して投げ直す。 */
export async function runOp<T>(operation: DataStoreOperation, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    throw classifyDataStoreError(operation, err)
  }
}

/**
 * getItem 専用。「無い」を undefined に落とす。
 *
 * putItem / query / deleteItem の "not found" は設定ミスの可能性があるため吸収しない
 * （runOp を使うこと）。
 */
export async function runGet<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn()
  } catch (err) {
    if (isNotFoundError(err)) return undefined
    throw classifyDataStoreError('getItem', err)
  }
}
