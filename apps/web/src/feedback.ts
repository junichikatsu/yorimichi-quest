/**
 * 音と振動での知らせ（FR-02-10）。
 *
 * ★ これは装飾ではない。**画面を見ずに歩けるようにするための機構**である。
 * 進捗が画面にしか出ないなら、歩きながら画面を見ることになる（NFR-14）。
 *
 * ★ 実機で測ってから決めている（LINE の WebView / 2026-08-21）。
 *
 * | | iOS | Android |
 * | --- | --- | --- |
 * | 音（WebAudio） | 鳴った | 鳴った |
 * | マナーモードでも鳴る | `audioSession = 'playback'` で鳴った | 元から鳴る（media 音量） |
 * | `navigator.vibrate` | **不可**（呼べても無視される） | 可 |
 *
 * よって **音を主、振動を補助**として扱う。振動しない端末でも成立させること。
 * iOS の触覚を鳴らす抜け道（`input switch` の副作用）は実機で無反応を確認した。
 * Apple が塞いだ経路であり、載せない。
 */

type AudioContextCtor = new () => AudioContext

interface AudioSessionLike {
  type: string
}

let ctx: AudioContext | undefined

function audioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const scope = window as unknown as {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  return scope.AudioContext ?? scope.webkitAudioContext
}

function audioSession(): AudioSessionLike | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as unknown as { audioSession?: AudioSessionLike }).audioSession
}

/** テストのために内部状態を捨てる */
export function resetFeedback(): void {
  ctx = undefined
}

/** 音を鳴らせる状態か */
export function canPlaySound(): boolean {
  return ctx !== undefined && ctx.state === 'running'
}

/**
 * 音を鳴らせるようにする。
 *
 * ★ 必ず**ユーザー操作の中から**呼ぶこと。操作の外で作った AudioContext は
 * iOS では suspended のままで、以降どれだけ鳴らそうとしても無音になる。
 * 「散歩をはじめる」の1タップに寄せてあるのはこのためである。
 */
export async function enableSound(): Promise<boolean> {
  const Ctor = audioContextCtor()
  if (!Ctor) return false

  /*
   * マナーモードでも鳴らす。
   * iOS の既定（ambient）は消音スイッチに従うため、通知として使えない。
   * Safari 独自かつ策定中の API なので、無い場合も落とさない。
   */
  const session = audioSession()
  if (session) {
    try {
      session.type = 'playback'
    } catch {
      // 立てられなくても音そのものは鳴る（マナーモードで無音になるだけ）
    }
  }

  try {
    ctx ??= new Ctor()
    if (ctx.state !== 'running') await ctx.resume()
    return ctx.state === 'running'
  } catch {
    return false
  }
}

/** 端末を振動させる。対応していなければ何もしない（iOS は常にここで終わる） */
export function vibrate(pattern: number[]): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { vibrate?: (pattern: number[]) => boolean }
  if (typeof nav.vibrate !== 'function') return false

  try {
    return nav.vibrate(pattern)
  } catch {
    return false
  }
}

/**
 * 単音を鳴らす。
 *
 * 音量は控えめにする。ポケットに入れて歩く前提なので、耳障りだと切られてしまう。
 * 端末の音量そのものは Web からは変えられない。
 */
function tone(startAt: number, freq: number, durationSec: number): void {
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq

  // 立ち上がりと減衰を付ける。矩形に切ると「プツッ」というノイズが乗る
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + durationSec + 0.05)
}

function playSequence(freqs: number[], stepSec: number, durationSec: number): void {
  if (!canPlaySound() || !ctx) return

  const now = ctx.currentTime
  freqs.forEach((freq, index) => {
    tone(now + index * stepSec, freq, durationSec)
  })
}

/**
 * 町丁目が開いたときの知らせ。
 *
 * 上昇する2音にする。**下降だと失敗に聞こえる**ため、進捗の知らせには使わない。
 */
export function notifyAreaUnlocked(): void {
  playSequence([660, 990], 0.16, 0.3)
  vibrate([120, 90, 120])
}

/**
 * チェックインできる場所に着いたときの知らせ（FR-02-10）。
 *
 * ★ 他の知らせと**リズムで**区別する。同じ高さの2打から5度上へ跳ねる形で、
 * 開放（2音上昇）・チェックイン成功（3音上昇）と聞き分けられる。
 * 音程だけを変えても、ポケットの中では区別が付かない。
 *
 * ★ 下降させない。着いたことを失敗に聞こえる音で知らせてはいけない。
 *
 * ★ これが鳴ることを「近づく動機」にしてはならない（G-2・NFR-14）。
 * 鳴るのは圏内に入った一度だけで、近さで変わらない（`nearby.ts`）。
 */
export function notifyArrival(): void {
  playSequence([784, 784, 1175], 0.1, 0.2)
  vibrate([70, 60, 70, 60, 160])
}

/** 歩行中モードへ入った／出たときの短い知らせ。画面を見ずに切り替わりが分かるように */
export function notifyWalkGuard(entering: boolean): void {
  playSequence(entering ? [520] : [780], 0.12, 0.18)
  vibrate([60])
}

/**
 * チェックインできたときの知らせ（FR-03-2）。
 *
 * ★ 上昇する3音にする。歩行中モードでは画面を見ていないので、
 * **音だけで「入った」と分かる**必要がある。
 */
export function notifyCheckin(): void {
  playSequence([523, 659, 784], 0.11, 0.22)
  vibrate([80, 60, 120])
}

/**
 * カードを手に入れたときの知らせ（FR-14-8）。
 *
 * ★ いちばん長い上昇にする。**手に入れたことがいちばん嬉しい出来事**であり、
 * チェックイン（3音）より短いと格が逆さまになる。
 *
 * ★ 鳴らすのは演出が**画面に出た瞬間**である（獲得した瞬間ではない）。
 * カードの演出はポイントの演出が消えてから出るので、獲得時に鳴らすと
 * 何も出ていないところで鳴る。
 */
export function notifyCardAcquired(): void {
  playSequence([523, 659, 784, 1046], 0.12, 0.34)
  vibrate([90, 60, 90, 60, 200])
}

/**
 * 浸水想定区域に入ったときの知らせ（#72）。
 *
 * ★ **報酬の音にしない。** 開放・到着・チェックイン・カードはすべて上昇する音で、
 * 「良いことが起きた」と伝えるためのものである。これは知らせであって報酬ではない。
 * いちばん低い音を同じ高さで3打にして、**祝っていないことが音で分かる**ようにする。
 *
 * ★ 叱る音にもしない（G-7）。そこに住んでいる人も歩いている。
 * 下降させず、音量も他と同じに保つ。
 *
 * ★ 鳴らすのは**入った一度だけ**。区域を出るまで鳴らさない（湾岸は広範囲が
 * 想定区域なので、入るたびに鳴らすと鳴り続ける）。
 */
export function notifyHazard(): void {
  playSequence([330, 330, 330], 0.2, 0.26)
  vibrate([200, 110, 200])
}

/**
 * クイズの結果の知らせ（FR-04）。
 *
 * ★ 不正解でも下降音にしない。ペナルティを与えない設計（FR-04-6・G-7）なので、
 * 音で叱ってしまうと「間違えたら終わり」という印象だけが残る。
 * 同じ高さの短い2音にして、**次を促す**合図にする。
 */
export function notifyQuizResult(correct: boolean): void {
  if (correct) {
    playSequence([659, 880], 0.14, 0.26)
    vibrate([100, 60, 100])
    return
  }
  playSequence([587, 587], 0.12, 0.16)
  vibrate([60])
}
