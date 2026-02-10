import { api, ENDPOINTS } from '../api/config';
import {
  RepeatabilityPayload,
  ReproducibilityPayload,
  VariationPayload
} from '../types/htwTypes';

// ==================
// Section A
// ==================
export const saveRepeatability = async (payload: RepeatabilityPayload) => {
  const res = await api.post(
    ENDPOINTS.HTW_REPEATABILITY.CALCULATE,
    payload
  );
  return res.data;
};

// ==================
// Section B
// ==================
export const saveReproducibility = async (payload: ReproducibilityPayload) => {
  const res = await api.post(
    ENDPOINTS.HTW_REPRODUCIBILITY.CALCULATE,
    payload
  );
  return res.data;
};

// ==================
// Section C
// ==================
export const saveDriveInterface = async (payload: VariationPayload) => {
  const res = await api.post(
    ENDPOINTS.HTW_CALCULATIONS.DRIVE_INTERFACE_CALCULATE,
    payload
  );
  return res.data;
};

// ==================
// Section D
// ==================
export const saveLoadingPoint = async (payload: VariationPayload) => {
  const res = await api.post(
    ENDPOINTS.HTW_CALCULATIONS.LOADING_POINT_CALCULATE,
    payload
  );
  return res.data;
};

// ==================
// Section E
// ==================
export const saveOutputDrive = async (payload: VariationPayload) => {
  const res = await api.post(
    ENDPOINTS.HTW_CALCULATIONS.OUTPUT_DRIVE_CALCULATE,
    payload
  );
  return res.data;
};
