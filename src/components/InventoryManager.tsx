/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Inventory from './Inventory';
import { exportToCSV } from '../utils/fileExport';
import { generateAndSharePDF } from '../services/pdfService';

export default Inventory;
export { Inventory as InventoryManager, exportToCSV, generateAndSharePDF };
