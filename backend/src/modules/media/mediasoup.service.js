import mediasoup from 'mediasoup';
import { mediasoupConfig } from '../../config/mediasoup.js';
import { logger } from '../../utils/logger.js';

let workerPromise = null;

const createWorker = async () => {
  const worker = await mediasoup.createWorker(mediasoupConfig.worker);

  worker.on('died', () => {
    logger.error('mediasoup worker died unexpectedly. Restart the service.');
    process.exit(1);
  });

  logger.info('mediasoup worker created.');
  return worker;
};

export const mediasoupService = {
  async getWorker() {
    if (!workerPromise) {
      workerPromise = createWorker();
    }

    return workerPromise;
  },
};
