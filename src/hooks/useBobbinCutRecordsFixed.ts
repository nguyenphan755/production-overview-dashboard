import { useCallback, useEffect, useRef, useState } from 'react';
import type { Machine, OrderBobbinRecord } from '../types';
import { effectiveProducedLengthOkM } from '../utils/effectiveProducedLength';

const STORAGE_KEY = 'production-dashboard-bobbin-cuts:v1';
const LENGTH_OK_EPS_M = 2;
// Nếu reset xảy ra nhanh giữa 2 lần sample, ta có thể không thấy giá trị <=2m.
// Khi đó ta suy ra reset dựa trên mức rơi lớn giữa prevOk và producedLengthOk.
const MISSED_RESET_MIN_DROP_M = 50;
const MISSED_RESET_RATIO = 0.2;

type Store = Record<string, Record<string, OrderBobbinRecord[]>>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

function bobbinId(orderId: string, sequence: number): string {
  const safe = orderId.replace(/[^\w.-]/g, '_');
  return `BOB-${safe}-${String(sequence).padStart(3, '0')}`;
}

export function getBobbinCutsForOrder(machineId: string, orderId: string): OrderBobbinRecord[] {
  const store = readStore();
  return store[machineId]?.[orderId] ?? [];
}

export function mergeCutsForOrder(
  machineId: string,
  orderId: string,
  apiCuts?: OrderBobbinRecord[]
): OrderBobbinRecord[] {
  const localCuts = getBobbinCutsForOrder(machineId, orderId);
  const byId = new Map<string, OrderBobbinRecord>();
  for (const c of apiCuts ?? []) byId.set(c.id, c);
  for (const c of localCuts) byId.set(c.id, c);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );
}

function appendCutToStore(
  machineId: string,
  orderId: string,
  cutLengthOkM: number,
  bobbinCountPlanned?: number
): boolean {
  const store = readStore();
  const forMachine = { ...(store[machineId] ?? {}) };
  const existing = [...(forMachine[orderId] ?? [])];

  const nextSeq =
    existing.length > 0 ? Math.max(...existing.map((r) => r.sequence)) + 1 : 1;

  const record: OrderBobbinRecord = {
    id: bobbinId(orderId, nextSeq),
    orderId,
    sequence: nextSeq,
    cutLengthM: cutLengthOkM,
    recordedAt: new Date().toISOString(),
    bobbinCountPlanned,
  };

  forMachine[orderId] = [...existing, record];
  store[machineId] = forMachine;
  writeStore(store);
  return true;
}

function resolveProductionOrderId(machine: Machine): string | undefined {
  const id = machine.productionOrderId?.trim();
  if (id) return id;

  const name = machine.productionOrderName?.trim();
  if (name && /^PO[-\w./]+/i.test(name)) return name;

  return undefined;
}

export function useBobbinCutDetector(
  machineId: string | undefined,
  machine: Machine | null | undefined,
  bobbinCountPlanned?: number
) {
  const prevOkLengthRef = useRef<number | null>(null);
  const peakOkLengthInCycleRef = useRef(0);
  const prevOrderIdRef = useRef<string | undefined>(undefined);

  const pendingStopCutRef = useRef(false);
  const pendingStopOrderIdRef = useRef<string | undefined>(undefined);
  const pendingStopPeakRef = useRef(0);
  const prevStatusRef = useRef<string | undefined>(undefined);

  const [cutsVersion, setCutsVersion] = useState(0);

  const producedLengthOk = machine ? effectiveProducedLengthOkM(machine) : 0;
  const activeOrderId = machine ? resolveProductionOrderId(machine) : undefined;
  const machineStatus = machine?.status;

  const appendCut = useCallback(
    (cutLengthOkM: number, orderId: string) => {
      if (!machineId) return;
      const appended = appendCutToStore(
        machineId,
        orderId,
        cutLengthOkM,
        bobbinCountPlanned
      );
      if (appended) setCutsVersion((v) => v + 1);
    },
    [machineId, bobbinCountPlanned]
  );

  useEffect(() => {
    if (!machineId || !activeOrderId) {
      prevOkLengthRef.current = null;
      peakOkLengthInCycleRef.current = 0;
      prevOrderIdRef.current = undefined;
      pendingStopCutRef.current = false;
      pendingStopOrderIdRef.current = undefined;
      pendingStopPeakRef.current = 0;
      prevStatusRef.current = undefined;
      return;
    }

    const prevOk = prevOkLengthRef.current;
    const prevOrderId = prevOrderIdRef.current;
    const prevStatus = prevStatusRef.current;

    if (prevOk === null) {
      prevOkLengthRef.current = producedLengthOk;
      prevOrderIdRef.current = activeOrderId;
      peakOkLengthInCycleRef.current =
        producedLengthOk > LENGTH_OK_EPS_M ? producedLengthOk : 0;
      prevStatusRef.current = machineStatus;
      return;
    }

    const crossedToReset =
      prevOk > LENGTH_OK_EPS_M && producedLengthOk <= LENGTH_OK_EPS_M;

    const looksLikeMissedReset =
      // có trước reset
      prevOk > LENGTH_OK_EPS_M &&
      // rơi đủ lớn
      prevOk - producedLengthOk >= MISSED_RESET_MIN_DROP_M &&
      // rơi đủ tương đối để tránh nhiễu
      producedLengthOk <= prevOk * (1 - MISSED_RESET_RATIO) &&
      // hiện tại đã lên lại > ngưỡng (nên không thoả crossedToReset)
      producedLengthOk > LENGTH_OK_EPS_M;

    if (producedLengthOk > LENGTH_OK_EPS_M) {
      peakOkLengthInCycleRef.current = Math.max(
        peakOkLengthInCycleRef.current,
        producedLengthOk
      );
    }

    if (crossedToReset || looksLikeMissedReset) {
      const orderIdToRecord = prevOrderId || activeOrderId;
      const cutLengthOkM = Math.max(peakOkLengthInCycleRef.current, prevOk);
      if (cutLengthOkM > LENGTH_OK_EPS_M) {
        appendCut(cutLengthOkM, orderIdToRecord);
      }

      peakOkLengthInCycleRef.current = 0;
      pendingStopCutRef.current = false;
      pendingStopOrderIdRef.current = undefined;
      pendingStopPeakRef.current = 0;

      // Nếu là missed reset và hiện tại vẫn > ngưỡng,
      // cycle mới vừa bắt đầu nên seed peak bằng giá trị hiện tại.
      if (looksLikeMissedReset && producedLengthOk > LENGTH_OK_EPS_M) {
        peakOkLengthInCycleRef.current = producedLengthOk;
      }
    } else if (prevStatus === 'running' && machineStatus !== 'running') {
      pendingStopCutRef.current = peakOkLengthInCycleRef.current > LENGTH_OK_EPS_M;
      pendingStopOrderIdRef.current = activeOrderId;
      pendingStopPeakRef.current = peakOkLengthInCycleRef.current;
    } else if (
      machineStatus === 'running' &&
      pendingStopCutRef.current &&
      pendingStopOrderIdRef.current === activeOrderId
    ) {
      const cutLengthOkM = Math.max(
        pendingStopPeakRef.current,
        peakOkLengthInCycleRef.current
      );
      if (cutLengthOkM > LENGTH_OK_EPS_M) {
        appendCut(cutLengthOkM, activeOrderId);
      }

      pendingStopCutRef.current = false;
      pendingStopOrderIdRef.current = undefined;
      pendingStopPeakRef.current = 0;
      peakOkLengthInCycleRef.current =
        producedLengthOk > LENGTH_OK_EPS_M ? producedLengthOk : 0;
    } else if (
      prevOrderId &&
      prevOrderId !== activeOrderId &&
      producedLengthOk > LENGTH_OK_EPS_M
    ) {
      peakOkLengthInCycleRef.current = producedLengthOk;
    }

    prevOkLengthRef.current = producedLengthOk;
    prevOrderIdRef.current = activeOrderId;
    prevStatusRef.current = machineStatus;
  }, [machineId, activeOrderId, producedLengthOk, machineStatus, appendCut]);

  return { cutsVersion };
}

type FleetMachineState = {
  prevOk: number | null;
  prevOrderId?: string;
  prevStatus?: string;
  peakOkLengthInCycle: number;
  pendingStopCut: boolean;
  pendingStopOrderId?: string;
  pendingStopPeak: number;
};

export function useBobbinCutDetectorForFleet(machines: Machine[]) {
  const stateByMachineRef = useRef<Record<string, FleetMachineState>>({});

  useEffect(() => {
    if (!machines || machines.length === 0) return;

    for (const machine of machines) {
      const machineId = machine.id;
      const activeOrderId = resolveProductionOrderId(machine);
      const producedLengthOk = effectiveProducedLengthOkM(machine);
      const nextMachineStatus = machine.status;

      if (!machineId || !activeOrderId) {
        delete stateByMachineRef.current[machineId];
        continue;
      }

      const prevState = stateByMachineRef.current[machineId] ?? {
        prevOk: null,
        prevOrderId: undefined,
        prevStatus: undefined,
        peakOkLengthInCycle: 0,
        pendingStopCut: false,
        pendingStopOrderId: undefined,
        pendingStopPeak: 0,
      };

      if (prevState.prevOk === null) {
        stateByMachineRef.current[machineId] = {
          ...prevState,
          prevOk: producedLengthOk,
          prevOrderId: activeOrderId,
          prevStatus: nextMachineStatus,
          peakOkLengthInCycle:
            producedLengthOk > LENGTH_OK_EPS_M ? producedLengthOk : 0,
        };
        continue;
      }

      const prevOk = prevState.prevOk;
      const prevOrderId = prevState.prevOrderId;
      const prevStatus = prevState.prevStatus;

      const crossedToReset =
        prevOk > LENGTH_OK_EPS_M && producedLengthOk <= LENGTH_OK_EPS_M;

      const looksLikeMissedReset =
        // có trước reset
        prevOk > LENGTH_OK_EPS_M &&
        // rơi đủ lớn
        prevOk - producedLengthOk >= MISSED_RESET_MIN_DROP_M &&
        // rơi đủ tương đối
        producedLengthOk <= prevOk * (1 - MISSED_RESET_RATIO) &&
        // hiện tại đã lên lại > ngưỡng
        producedLengthOk > LENGTH_OK_EPS_M;

      let nextPeak = prevState.peakOkLengthInCycle;
      if (producedLengthOk > LENGTH_OK_EPS_M) {
        nextPeak = Math.max(nextPeak, producedLengthOk);
      }

      let nextPendingStopCut = prevState.pendingStopCut;
      let nextPendingStopOrderId = prevState.pendingStopOrderId;
      let nextPendingStopPeak = prevState.pendingStopPeak;

      if (crossedToReset || looksLikeMissedReset) {
        const orderIdToRecord = prevOrderId || activeOrderId;
        const cutLengthOkM = Math.max(nextPeak, prevOk);
        if (cutLengthOkM > LENGTH_OK_EPS_M) {
          appendCutToStore(machineId, orderIdToRecord, cutLengthOkM);
        }
        nextPeak = 0;
        nextPendingStopCut = false;
        nextPendingStopOrderId = undefined;
        nextPendingStopPeak = 0;

        if (looksLikeMissedReset && producedLengthOk > LENGTH_OK_EPS_M) {
          nextPeak = producedLengthOk;
        }
      } else if (prevStatus === 'running' && nextMachineStatus !== 'running') {
        nextPendingStopCut = nextPeak > LENGTH_OK_EPS_M;
        nextPendingStopOrderId = activeOrderId;
        nextPendingStopPeak = nextPeak;
      } else if (
        nextMachineStatus === 'running' &&
        nextPendingStopCut &&
        nextPendingStopOrderId === activeOrderId
      ) {
        const cutLengthOkM = Math.max(nextPendingStopPeak, nextPeak);
        if (cutLengthOkM > LENGTH_OK_EPS_M) {
          appendCutToStore(machineId, activeOrderId, cutLengthOkM);
        }
        nextPendingStopCut = false;
        nextPendingStopOrderId = undefined;
        nextPendingStopPeak = 0;
        nextPeak = producedLengthOk > LENGTH_OK_EPS_M ? producedLengthOk : 0;
      } else if (
        prevOrderId &&
        prevOrderId !== activeOrderId &&
        producedLengthOk > LENGTH_OK_EPS_M
      ) {
        nextPeak = producedLengthOk;
      }

      stateByMachineRef.current[machineId] = {
        prevOk: producedLengthOk,
        prevOrderId: activeOrderId,
        prevStatus: nextMachineStatus,
        peakOkLengthInCycle: nextPeak,
        pendingStopCut: nextPendingStopCut,
        pendingStopOrderId: nextPendingStopOrderId,
        pendingStopPeak: nextPendingStopPeak,
      };
    }
  }, [machines]);
}

