import { schedule, shutdown } from 'node-cron'
import { config } from '../../../config.js'
import { createScheduledJobRunCoordinator } from './scheduled-job-run-coordinator.js'
import {
  attachScheduledJobLogging,
  logScheduledJobDisabled,
  logScheduledJobEnabled
} from './scheduled-job-logging.js'
import { scheduledJobs } from './scheduled-jobs.js'
import { SCHEDULER_SHUTDOWN_TIMEOUT_MS } from '../../common/constants/job-scheduler.js'

const schedulerPlugin = {
  plugin: {
    name: 'scheduler',
    register: async (server) => {
      const { isEnabled, timezone, jobs } = config.get('scheduler')

      // Registered unconditionally: a job body must stay invokable by hand in
      // environments where scheduling itself is switched off.
      for (const job of scheduledJobs) {
        server.method(job.methodName, () => job.run(server), {})
      }

      if (!isEnabled) {
        server.logger.info(
          {
            event: {
              action: 'scheduler:startup',
              outcome: 'unknown',
              reason: 'Disabled by configuration'
            }
          },
          'Scheduler disabled by configuration; no jobs scheduled'
        )
        return
      }

      server.ext('onPostStart', () => {
        const coordinator = createScheduledJobRunCoordinator(
          server.db,
          server.logger
        )

        server.app.schedulerTasks = scheduledJobs
          .filter((job) => {
            if (jobs[job.name].isEnabled) {
              return true
            }
            logScheduledJobDisabled(job.name, server.logger)
            return false
          })
          .map((job) => {
            const task = schedule(
              jobs[job.name].schedule,
              () => job.run(server),
              {
                name: job.name,
                timezone,
                distributed: true,
                runCoordinator: coordinator,
                noOverlap: true,
                logger: server.logger
              }
            )

            attachScheduledJobLogging(task, job.name, server.logger)
            logScheduledJobEnabled(
              job.name,
              jobs[job.name].schedule,
              timezone,
              server.logger
            )
            return task
          })
      })

      server.ext('onPreStop', async () => {
        // Not task.destroy(): that only clears the timer and leaves a job that
        // is mid-run as a detached promise, which is then torn down when the
        // Mongo client is force-closed on stop. shutdown() stops every task,
        // awaits any busy one, and only then destroys them.
        await shutdown(SCHEDULER_SHUTDOWN_TIMEOUT_MS)
        server.app.schedulerTasks = []
      })

      server.logger.info('scheduler plugin registered')
    }
  }
}

export { schedulerPlugin }
