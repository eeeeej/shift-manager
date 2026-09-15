import type { Shift } from '../types'

export interface LaidOutShift {
  shift: Shift
  lane: number
  laneCount: number
}

/**
 * Assign overlapping shifts to side-by-side lanes. Shifts are grouped into
 * clusters of transitive overlap; each cluster shares a lane count so cards
 * fill the column width evenly.
 */
export function layoutLanes(shifts: Shift[]): LaidOutShift[] {
  const sorted = [...shifts].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const result: LaidOutShift[] = []
  let cluster: LaidOutShift[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1

  const flush = () => {
    const count = laneEnds.length
    for (const item of cluster) item.laneCount = count
    result.push(...cluster)
    cluster = []
    laneEnds = []
  }

  for (const shift of sorted) {
    if (cluster.length && shift.startMin >= clusterEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= shift.startMin)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(shift.endMin)
    } else {
      laneEnds[lane] = shift.endMin
    }
    cluster.push({ shift, lane, laneCount: 0 })
    clusterEnd = Math.max(clusterEnd, shift.endMin)
  }
  flush()
  return result
}
