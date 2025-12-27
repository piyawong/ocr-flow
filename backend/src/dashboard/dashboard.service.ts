import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Subject, Observable, interval } from 'rxjs';
import { File } from '../files/file.entity';
import { Group } from '../files/group.entity';
import { Document } from '../labeled-files/document.entity';
import { FoundationInstrument } from '../files/foundation-instrument.entity';
import { CommitteeMember } from '../files/committee-member.entity';

interface DashboardUpdate {
  timestamp: Date;
  summary?: any;
  stageProgress?: any;
  metrics?: any;
  activity?: any[];
  alerts?: any[];
}

@Injectable()
export class DashboardService {
  private updateSubject = new Subject<DashboardUpdate>();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(FoundationInstrument)
    private readonly foundationRepository: Repository<FoundationInstrument>,
    @InjectRepository(CommitteeMember)
    private readonly committeeRepository: Repository<CommitteeMember>,
  ) {
    // Start periodic updates (every 5 seconds)
    this.startPeriodicUpdates();
  }

  /**
   * Get summary statistics for dashboard
   */
  async getSummary() {
    // Total counts
    const totalFiles = await this.fileRepository.count();
    const totalGroups = await this.groupRepository.count();
    const totalDocuments = await this.documentRepository.count();
    const foundationsProcessed = await this.foundationRepository.count();
    const finalApproved = await this.groupRepository.count({
      where: [
        { finalReview03: 'approved', finalReview04: 'approved' },
      ],
    });

    // Get counts from 7 days ago for trend calculation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const filesLast7Days = await this.fileRepository.count({
      where: { createdAt: MoreThan(sevenDaysAgo) },
    });
    const groupsLast7Days = await this.groupRepository.count({
      where: { createdAt: MoreThan(sevenDaysAgo) },
    });
    const docsLast7Days = await this.documentRepository.count({
      where: { createdAt: MoreThan(sevenDaysAgo) },
    });
    const foundationsLast7Days = await this.foundationRepository.count({
      where: { createdAt: MoreThan(sevenDaysAgo) },
    });
    const approvedLast7Days = await this.groupRepository
      .createQueryBuilder('group')
      .where('group.finalReview03 = :approved03', { approved03: 'approved' })
      .andWhere('group.finalReview04 = :approved04', { approved04: 'approved' })
      .andWhere('(group.finalReview03ReviewedAt > :date OR group.finalReview04ReviewedAt > :date)', { date: sevenDaysAgo })
      .getCount();

    // Calculate trends (percentage)
    const calculateTrend = (current: number, recent: number) => {
      if (current === 0) return 0;
      return Math.round((recent / current) * 100);
    };

    return {
      totalFiles,
      totalGroups,
      totalDocuments,
      foundationsProcessed,
      finalApproved,
      trends: {
        files: `+${calculateTrend(totalFiles, filesLast7Days)}%`,
        groups: `+${calculateTrend(totalGroups, groupsLast7Days)}%`,
        documents: `+${calculateTrend(totalDocuments, docsLast7Days)}%`,
        foundations: `+${calculateTrend(foundationsProcessed, foundationsLast7Days)}%`,
        approved: `+${calculateTrend(finalApproved, approvedLast7Days)}%`,
      },
    };
  }

  /**
   * Get stage progress statistics
   */
  async getStageProgress() {
    // Stage 01: Files pending OCR
    const stage01Pending = await this.fileRepository.count({
      where: { processed: false },
    });

    // Stage 02: Groups unlabeled vs labeled
    const stage02Unlabeled = await this.groupRepository.count({
      where: {
        isAutoLabeled: false,
      },
    });
    const stage02Labeled = await this.groupRepository.count({
      where: { isAutoLabeled: true },
    });

    // Stage 03: Unreviewed vs reviewed (labeled)
    const stage03Unreviewed = await this.groupRepository.count({
      where: {
        isAutoLabeled: true,
        isLabeledReviewed: false,
      },
    });
    const stage03Reviewed = await this.groupRepository.count({
      where: { isLabeledReviewed: true },
    });

    // Stage 04: Parse data unreviewed vs reviewed
    const stage04Unreviewed = await this.groupRepository.count({
      where: {
        isParseData: true,
        isParseDataReviewed: false,
      },
    });
    const stage04Reviewed = await this.groupRepository.count({
      where: { isParseDataReviewed: true },
    });

    // Stage 05: Pending approval vs approved
    const stage05Pending = await this.groupRepository
      .createQueryBuilder('group')
      .where('group.isLabeledReviewed = :reviewed', { reviewed: true })
      .andWhere('group.isParseDataReviewed = :reviewed', { reviewed: true })
      .andWhere('(group.finalReview03 != :approved03 OR group.finalReview04 != :approved04)', { approved03: 'approved', approved04: 'approved' })
      .getCount();
    const stage05Approved = await this.groupRepository.count({
      where: [
        { finalReview03: 'approved', finalReview04: 'approved' },
      ],
    });

    return {
      stage01: { pending: stage01Pending },
      stage02: {
        unlabeled: stage02Unlabeled,
        labeled: stage02Labeled,
      },
      stage03: {
        unreviewed: stage03Unreviewed,
        reviewed: stage03Reviewed,
      },
      stage04: {
        unreviewed: stage04Unreviewed,
        reviewed: stage04Reviewed,
      },
      stage05: {
        pending: stage05Pending,
        approved: stage05Approved,
      },
    };
  }

  /**
   * Get performance and quality metrics
   */
  async getMetrics() {
    // Total groups with labels
    const totalLabeledGroups = await this.groupRepository.count({
      where: { isAutoLabeled: true },
    });

    // Get all labeled groups to calculate match rate
    const labeledGroups = await this.groupRepository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.files', 'file')
      .where('group.isAutoLabeled = :isLabeled', { isLabeled: true })
      .getMany();

    // Calculate match rate
    let totalMatched = 0;
    let totalGroups = labeledGroups.length;

    // Get document counts for each group
    for (const group of labeledGroups) {
      const totalPages = group.files?.filter(f => f.groupId === group.id).length || 0;
      const matchedPages = await this.documentRepository.count({
        where: { groupId: group.id },
      });

      if (totalPages > 0 && matchedPages === totalPages) {
        totalMatched++;
      }
    }

    const matchRate = totalGroups > 0
      ? Math.round((totalMatched / totalGroups) * 100)
      : 0;

    // OCR Success Rate
    const totalFiles = await this.fileRepository.count();
    const processedFiles = await this.fileRepository.count({
      where: { processed: true },
    });
    const ocrSuccessRate = totalFiles > 0
      ? Math.round((processedFiles / totalFiles) * 100)
      : 0;

    // Review completion rate (labeled)
    const reviewedGroups = await this.groupRepository.count({
      where: { isLabeledReviewed: true },
    });
    const reviewRate = totalLabeledGroups > 0
      ? Math.round((reviewedGroups / totalLabeledGroups) * 100)
      : 0;

    // Approval rate
    const readyForApproval = await this.groupRepository.count({
      where: {
        isLabeledReviewed: true,
        isParseDataReviewed: true,
      },
    });
    const approvedGroups = await this.groupRepository.count({
      where: [
        { finalReview03: 'approved', finalReview04: 'approved' },
      ],
    });
    const approvalRate = readyForApproval > 0
      ? Math.round((approvedGroups / readyForApproval) * 100)
      : 0;

    // Throughput (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const throughputLast24h = await this.fileRepository.count({
      where: {
        processed: true,
        processedAt: MoreThan(oneDayAgo),
      },
    });

    // Average processing time (approximation based on processed files)
    // Note: This is a simplified calculation
    const avgProcessingTime = 2.3; // TODO: Calculate from actual data

    return {
      matchRate,
      ocrSuccessRate,
      reviewRate,
      approvalRate,
      avgProcessingTime,
      throughput: throughputLast24h,
    };
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(limit: number = 10) {
    const activities = [];

    // Recent files uploaded
    const recentFiles = await this.fileRepository.count({
      where: {
        createdAt: MoreThan(new Date(Date.now() - 3600000)), // Last hour
      },
    });
    if (recentFiles > 0) {
      activities.push({
        type: 'upload',
        message: `${recentFiles} file${recentFiles > 1 ? 's' : ''} uploaded`,
        count: recentFiles,
        timestamp: new Date(),
      });
    }

    // Recent groups created
    const recentGroups = await this.groupRepository.count({
      where: {
        createdAt: MoreThan(new Date(Date.now() - 3600000)), // Last hour
      },
    });
    if (recentGroups > 0) {
      activities.push({
        type: 'group',
        message: `${recentGroups} group${recentGroups > 1 ? 's' : ''} created`,
        count: recentGroups,
        timestamp: new Date(),
      });
    }

    // Recent reviews
    const recentReviews = await this.groupRepository.count({
      where: {
        isLabeledReviewed: true,
        // Note: We don't have a review timestamp, using updatedAt as proxy
      },
      take: limit,
    });
    if (recentReviews > 0) {
      activities.push({
        type: 'review',
        message: `${recentReviews} review${recentReviews > 1 ? 's' : ''} completed`,
        count: recentReviews,
        timestamp: new Date(),
      });
    }

    // Recent approvals
    const recentApprovals = await this.groupRepository
      .createQueryBuilder('group')
      .where('group.finalReview03 = :approved03', { approved03: 'approved' })
      .andWhere('group.finalReview04 = :approved04', { approved04: 'approved' })
      .andWhere('(group.finalReview03ReviewedAt > :date OR group.finalReview04ReviewedAt > :date)', { date: new Date(Date.now() - 3600000) })
      .getCount();
    if (recentApprovals > 0) {
      activities.push({
        type: 'approval',
        message: `${recentApprovals} approval${recentApprovals > 1 ? 's' : ''} granted`,
        count: recentApprovals,
        timestamp: new Date(),
      });
    }

    return activities.slice(0, limit);
  }

  /**
   * Get alerts and issues
   */
  async getAlerts() {
    const alerts = [];

    // Files stuck in processing (> 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);
    const stuckFiles = await this.fileRepository.count({
      where: {
        processed: false,
        createdAt: MoreThan(new Date(Date.now() - 3600000)), // Created in last hour
      },
    });

    if (stuckFiles > 3) {
      alerts.push({
        level: 'warning',
        message: `${stuckFiles} files stuck in processing (>5min)`,
        count: stuckFiles,
        action: 'Check OCR service',
      });
    }

    // Groups with low match rate (< 50%)
    const lowMatchGroups = await this.groupRepository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.files', 'file')
      .where('group.isAutoLabeled = :isLabeled', { isLabeled: true })
      .getMany();

    let lowMatchCount = 0;
    for (const group of lowMatchGroups) {
      const totalPages = group.files?.filter(f => f.groupId === group.id).length || 0;
      const matchedPages = await this.documentRepository.count({
        where: { groupId: group.id },
      });
      const matchPercentage = totalPages > 0 ? (matchedPages / totalPages) * 100 : 0;

      if (matchPercentage < 50 && matchPercentage > 0) {
        lowMatchCount++;
      }
    }

    if (lowMatchCount > 0) {
      alerts.push({
        level: 'error',
        message: `${lowMatchCount} group${lowMatchCount > 1 ? 's' : ''} with low match rate (<50%)`,
        count: lowMatchCount,
        action: 'Review templates',
      });
    }

    // Stage 05 bottleneck (> 20 pending)
    const stage05Pending = await this.groupRepository
      .createQueryBuilder('group')
      .where('group.isLabeledReviewed = :reviewed', { reviewed: true })
      .andWhere('group.isParseDataReviewed = :reviewed', { reviewed: true })
      .andWhere('(group.finalReview03 != :approved03 OR group.finalReview04 != :approved04)', { approved03: 'approved', approved04: 'approved' })
      .getCount();

    if (stage05Pending > 20) {
      alerts.push({
        level: 'info',
        message: `Stage 05 bottleneck: ${stage05Pending} pending approvals`,
        count: stage05Pending,
        action: 'Admin review needed',
      });
    }

    return alerts;
  }

  /**
   * Get trend data for charts (last 7 days)
   */
  async getTrends(period: string = '7d') {
    const days = parseInt(period) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Generate daily data points
    const dailyData = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const filesCount = await this.fileRepository.count({
        where: {
          createdAt: MoreThan(date),
        },
      });

      const groupsCount = await this.groupRepository.count({
        where: {
          createdAt: MoreThan(date),
        },
      });

      dailyData.push({
        date: date.toISOString().split('T')[0],
        files: filesCount,
        groups: groupsCount,
      });
    }

    // Stage distribution (current)
    const stageProgress = await this.getStageProgress();
    const stageDistribution = {
      stage01: stageProgress.stage01.pending,
      stage02: stageProgress.stage02.unlabeled,
      stage03: stageProgress.stage03.unreviewed,
      stage04: stageProgress.stage04.unreviewed,
      stage05: stageProgress.stage05.pending,
    };

    return {
      daily: dailyData,
      stageDistribution,
    };
  }

  /**
   * Get Observable for real-time updates
   */
  getUpdateObservable(): Observable<DashboardUpdate> {
    return this.updateSubject.asObservable();
  }

  /**
   * Start periodic dashboard updates (every 5 seconds)
   */
  private startPeriodicUpdates() {
    // Clear existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Broadcast updates every 5 seconds
    this.updateInterval = setInterval(async () => {
      await this.broadcastUpdate();
    }, 5000);
  }

  /**
   * Broadcast dashboard update to all listeners
   */
  async broadcastUpdate() {
    try {
      const [summary, stageProgress, metrics, activity, alerts] = await Promise.all([
        this.getSummary(),
        this.getStageProgress(),
        this.getMetrics(),
        this.getRecentActivity(5),
        this.getAlerts(),
      ]);

      const update: DashboardUpdate = {
        timestamp: new Date(),
        summary,
        stageProgress,
        metrics,
        activity,
        alerts,
      };

      this.updateSubject.next(update);
    } catch (error) {
      console.error('Error broadcasting dashboard update:', error);
    }
  }

  /**
   * Stop periodic updates (cleanup)
   */
  onModuleDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.updateSubject.complete();
  }
}
