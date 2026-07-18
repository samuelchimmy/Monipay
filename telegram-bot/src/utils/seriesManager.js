import { getSupabase } from '../../shared/database.js';
import { isValidSeriesId } from './recurringPayments.js';
import { formatSeriesMetadata } from './seriesCalculator.js';
import { escapeMd } from './replies.js';

/**
 * Series Manager
 * 
 * Handles recurring payment series lifecycle operations:
 * - Series creation with atomic database transactions
 * - Series cancellation with authorization
 * - Series status and progress tracking
 * - User series history
 */

// ============================================================================
// SERIES CREATION
// ============================================================================

/**
 * Create a recurring payment series in the database
 * All jobs are inserted atomically - either all succeed or all fail
 * @param {Array} jobs - Array of job objects to insert
 * @returns {Promise<Object>} {success: boolean, seriesId: string, jobsCreated: number, error?: string}
 */
export async function createRecurringSeries(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return {
      success: false,
      error: 'No jobs provided'
    };
  }

  const supabase = getSupabase();
  const seriesId = jobs[0].payload?.seriesId;

  console.log(`[SeriesManager] Creating series ${seriesId} with ${jobs.length} jobs`);

  try {
    // Insert all jobs in a single atomic operation
    // Supabase handles this as a transaction - either all succeed or all fail
    const { data: createdJobs, error: insertError } = await supabase
      .from('scheduled_jobs')
      .insert(jobs)
      .select();

    if (insertError) {
      console.error(`[SeriesManager] Failed to create series ${seriesId}:`, insertError.message);
      return {
        success: false,
        seriesId,
        error: insertError.message
      };
    }

    console.log(`[SeriesManager] Successfully created ${createdJobs.length} jobs for series ${seriesId}`);

    return {
      success: true,
      seriesId,
      jobsCreated: createdJobs.length,
      jobs: createdJobs
    };
  } catch (error) {
    console.error(`[SeriesManager] Exception creating series ${seriesId}:`, error.message);
    return {
      success: false,
      seriesId,
      error: error.message
    };
  }
}

// ============================================================================
// SERIES CANCELLATION
// ============================================================================

/**
 * Cancel a recurring payment series
 * Updates all pending jobs in the series to 'failed' status
 * Only the original creator can cancel a series
 * @param {string} seriesId - The series identifier
 * @param {string} userId - The user's platform ID for authorization
 * @param {string} platform - Platform identifier ('telegram', 'discord', 'x')
 * @returns {Promise<Object>} {success: boolean, cancelledCount: number, message: string}
 */
export async function cancelRecurringSeries(seriesId, userId, platform = 'telegram') {
  // Validate inputs
  if (!isValidSeriesId(seriesId)) {
    return {
      success: false,
      cancelledCount: 0,
      message: 'Invalid series ID format'
    };
  }

  if (!userId) {
    return {
      success: false,
      cancelledCount: 0,
      message: 'User ID required'
    };
  }

  const supabase = getSupabase();

  console.log(`[SeriesManager] Cancelling series ${seriesId} for user ${userId}`);

  try {
    // Find all pending jobs for this series that belong to the user
    const { data: pendingJobs, error: fetchError } = await supabase
      .from('scheduled_jobs')
      .select('id, payload, scheduled_at')
      .eq('status', 'pending')
      .eq('payload->>seriesId', seriesId)
      .eq('source_author_id', userId);

    if (fetchError) {
      console.error(`[SeriesManager] Error fetching jobs for series ${seriesId}:`, fetchError.message);
      return {
        success: false,
        cancelledCount: 0,
        message: 'Error fetching series jobs'
      };
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return {
        success: false,
        cancelledCount: 0,
        message: 'No pending payments found for this series or you are not authorized'
      };
    }

    // Update all pending jobs to failed status
    const jobIds = pendingJobs.map(job => job.id);
    const { error: updateError } = await supabase
      .from('scheduled_jobs')
      .update({
        status: 'failed',
        error_message: 'Cancelled by user',
        updated_at: new Date().toISOString()
      })
      .in('id', jobIds);

    if (updateError) {
      console.error(`[SeriesManager] Error cancelling jobs for series ${seriesId}:`, updateError.message);
      return {
        success: false,
        cancelledCount: 0,
        message: 'Error cancelling series jobs'
      };
    }

    console.log(`[SeriesManager] Successfully cancelled ${jobIds.length} jobs for series ${seriesId}`);

    return {
      success: true,
      cancelledCount: jobIds.length,
      message: `Successfully cancelled ${jobIds.length} pending payment${jobIds.length !== 1 ? 's' : ''}`
    };
  } catch (error) {
    console.error(`[SeriesManager] Exception cancelling series ${seriesId}:`, error.message);
    return {
      success: false,
      cancelledCount: 0,
      message: `Error: ${error.message}`
    };
  }
}

// ============================================================================
// SERIES STATUS AND PROGRESS
// ============================================================================

/**
 * Get the current status and progress of a recurring payment series
 * @param {string} seriesId - The series identifier
 * @returns {Promise<Object>} Series status object or null if not found
 */
export async function getSeriesStatus(seriesId) {
  if (!isValidSeriesId(seriesId)) {
    return null;
  }

  const supabase = getSupabase();

  try {
    // Fetch all jobs for this series
    const { data: jobs, error } = await supabase
      .from('scheduled_jobs')
      .select('id, status, scheduled_at, payload, result, error_message')
      .filter('payload->>seriesId', 'eq', seriesId)
      .order('scheduled_at', { ascending: true });

    if (error || !jobs || jobs.length === 0) {
      return null;
    }

    // Calculate status counts
    const statusCounts = {
      pending: 0,
      completed: 0,
      failed: 0,
      total: jobs.length
    };

    jobs.forEach(job => {
      if (statusCounts[job.status] !== undefined) {
        statusCounts[job.status]++;
      }
    });

    // Extract series metadata from first job
    const firstJob = jobs[0];
    const metadata = {
      seriesId,
      totalCount: firstJob.payload?.seriesTotalCount || jobs.length,
      interval: firstJob.payload?.seriesInterval,
      firstRun: firstJob.payload?.seriesFirstRun,
      lastRun: firstJob.payload?.seriesLastRun,
      command: firstJob.payload?.originalText,
      amount: firstJob.payload?.command?.amount,
    };

    // Calculate progress percentage
    const completed = statusCounts.completed + statusCounts.failed;
    const progressPercent = Math.round((completed / statusCounts.total) * 100);

    return {
      seriesId,
      metadata,
      statusCounts,
      progress: {
        completed,
        remaining: statusCounts.pending,
        total: statusCounts.total,
        percent: progressPercent
      },
      jobs: jobs.map(job => ({
        id: job.id,
        status: job.status,
        scheduledAt: job.scheduled_at,
        seriesIndex: job.payload?.seriesIndex,
        result: job.result,
        error: job.error_message
      }))
    };
  } catch (error) {
    console.error(`[SeriesManager] Error fetching series status ${seriesId}:`, error.message);
    return null;
  }
}

/**
 * Format series status for user-friendly display
 * @param {Object} status - Series status object from getSeriesStatus
 * @returns {string} Formatted status message
 */
export function formatSeriesStatus(status) {
  if (!status) {
    return '❌ Series not found';
  }

  const { metadata, statusCounts, progress } = status;
  
  const firstRunDate = new Date(metadata.firstRun);
  const lastRunDate = new Date(metadata.lastRun);
  
  const formatDate = (date) => {
    return date.toUTCString().replace(' GMT', ' UTC');
  };

  let statusEmoji = '⏳';
  if (progress.completed === progress.total) {
    statusEmoji = statusCounts.failed > 0 ? '⚠️' : '✅';
  }

  return (
    `${statusEmoji} *Recurring Payment Series Status*\n\n` +
    `📋 *Series ID:* \`${status.seriesId}\`\n` +
    `💬 *Command:* ${escapeMd(metadata.command)}\n` +
    `💰 *Amount per payment:* $${metadata.amount}\n\n` +
    `📊 *Progress:* ${progress.completed}/${progress.total} (${progress.percent}%)\n` +
    `✅ *Completed:* ${statusCounts.completed}\n` +
    `⏳ *Pending:* ${statusCounts.pending}\n` +
    `❌ *Failed:* ${statusCounts.failed}\n\n` +
    `🚀 *First payment:* ${formatDate(firstRunDate)}\n` +
    `🏁 *Last payment:* ${formatDate(lastRunDate)}`
  );
}

// ============================================================================
// USER SERIES HISTORY
// ============================================================================

/**
 * Get all recurring payment series for a user
 * @param {string} userId - User's platform ID
 * @param {Object} options - Query options
 * @param {boolean} options.activeOnly - Only return active series (default: false)
 * @param {number} options.limit - Maximum number of series to return (default: 10)
 * @returns {Promise<Array>} Array of series summaries
 */
export async function getUserSeries(userId, options = {}) {
  const { activeOnly = false, limit = 10 } = options;

  if (!userId) {
    return [];
  }

  const supabase = getSupabase();

  try {
    // Build query for jobs belonging to this user
    let query = supabase
      .from('scheduled_jobs')
      .select('payload, scheduled_at, status')
      .eq('source_author_id', userId)
      .not('payload->>seriesId', 'is', null)
      .order('scheduled_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('status', 'pending');
    }

    const { data: jobs, error } = await query;

    if (error || !jobs || jobs.length === 0) {
      return [];
    }

    // Group jobs by seriesId
    const seriesMap = new Map();
    
    jobs.forEach(job => {
      const seriesId = job.payload?.seriesId;
      if (!seriesId) return;

      if (!seriesMap.has(seriesId)) {
        seriesMap.set(seriesId, {
          seriesId,
          jobs: [],
          metadata: {
            totalCount: job.payload?.seriesTotalCount,
            interval: job.payload?.seriesInterval,
            firstRun: job.payload?.seriesFirstRun,
            lastRun: job.payload?.seriesLastRun,
            command: job.payload?.originalText,
            amount: job.payload?.command?.amount,
          }
        });
      }

      seriesMap.get(seriesId).jobs.push({
        status: job.status,
        scheduledAt: job.scheduled_at,
        index: job.payload?.seriesIndex
      });
    });

    // Convert to array and calculate summaries
    const seriesList = Array.from(seriesMap.values()).map(series => {
      const pending = series.jobs.filter(j => j.status === 'pending').length;
      const completed = series.jobs.filter(j => j.status === 'completed').length;
      const failed = series.jobs.filter(j => j.status === 'failed').length;
      const total = series.jobs.length;

      return {
        seriesId: series.seriesId,
        metadata: series.metadata,
        summary: {
          pending,
          completed,
          failed,
          total,
          isActive: pending > 0
        }
      };
    });

    // Filter and limit
    let filtered = activeOnly 
      ? seriesList.filter(s => s.summary.isActive)
      : seriesList;

    return filtered.slice(0, limit);
  } catch (error) {
    console.error(`[SeriesManager] Error fetching user series for ${userId}:`, error.message);
    return [];
  }
}

/**
 * Format user series list for display
 * @param {Array} seriesList - Array of series summaries
 * @returns {string} Formatted list
 */
export function formatUserSeriesList(seriesList) {
  if (!Array.isArray(seriesList) || seriesList.length === 0) {
    return '📋 *Your Recurring Payments*\n\nNo recurring payment series found.';
  }

  let message = `📋 *Your Recurring Payments* (${seriesList.length})\n\n`;

  seriesList.forEach((series, index) => {
    const { seriesId, metadata, summary } = series;
    const statusEmoji = summary.isActive ? '⏳' : (summary.failed > 0 ? '⚠️' : '✅');
    const progress = summary.completed + summary.failed;
    
    message += (
      `${index + 1}. ${statusEmoji} \`${seriesId.substring(0, 8)}...\`\n` +
      `   💬 ${escapeMd(metadata.command)}\n` +
      `   📊 ${progress}/${summary.total} completed\n` +
      `   ${summary.pending > 0 ? `⏳ ${summary.pending} pending` : ''}\n\n`
    );
  });

  return message;
}

// ============================================================================
// TYPE DEFINITIONS (JSDoc)
// ============================================================================

/**
 * @typedef {Object} SeriesStatus
 * @property {string} seriesId - Series identifier
 * @property {Object} metadata - Series metadata
 * @property {Object} statusCounts - Count of jobs by status
 * @property {Object} progress - Progress tracking
 * @property {Array} jobs - Individual job details
 */

/**
 * @typedef {Object} SeriesSummary
 * @property {string} seriesId - Series identifier
 * @property {Object} metadata - Series metadata
 * @property {Object} summary - Status summary (pending, completed, failed, total)
 */
