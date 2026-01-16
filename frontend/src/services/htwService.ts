import axios from 'axios';
import { 
  RepeatabilityPayload, 
  ReproducibilityPayload, 
  VariationPayload 
} from '../types/htwTypes';

const API_URL = 'http://localhost:8000/htw-calculations';

// Section A
export const saveRepeatability = async (payload: RepeatabilityPayload) => {
  const res = await axios.post(`${API_URL}/repeatability/calculate`, payload);
  return res.data;
};

// Section B
export const saveReproducibility = async (payload: ReproducibilityPayload) => {
  const res = await axios.post(`${API_URL}/reproducibility/calculate`, payload);
  return res.data;
};

// Section C
export const saveDriveInterface = async (payload: VariationPayload) => {
  const res = await axios.post(`${API_URL}/drive-interface/calculate`, payload);
  return res.data;
};

// Section D
export const saveLoadingPoint = async (payload: VariationPayload) => {
  const res = await axios.post(`${API_URL}/loading-point/calculate`, payload);
  return res.data;
};

// Section E
export const saveOutputDrive = async (payload: VariationPayload) => {
  const res = await axios.post(`${API_URL}/output-drive/calculate`, payload);
  return res.data;
};