import { getDatabase } from '../database/connection';
import { logger } from '../utils/logger';
import { SubscriptionAnalytics, UsageAnalytics } from '../types';

export class AnalyticsService {
  private db = getDatabase();

  async getDashboardMetrics(): Promise<any> {
    try {
      // Get total revenue
      const totalRevenueResult = await this.db('invoices')
        .where('status', 'paid')
        .sum('amount_paid as total_revenue')
        .first();

      const totalRevenue = parseFloat(totalRevenueResult?.total_revenue || '0');

      // Get total customers
      const totalCustomersResult = await this.db('customers')
        .whereNull('deleted_at')
        .count('id as count')
        .first();

      const totalCustomers = parseInt(totalCustomersResult?.count || '0');

      // Get active subscriptions
      const activeSubscriptionsResult = await this.db('subscriptions')
        .whereIn('status', ['active', 'trialing'])
        .count('id as count')
        .first();

      const activeSubscriptions = parseInt(activeSubscriptionsResult?.count || '0');

      // Calculate MRR
      const mrrResult = await this.db('subscriptions as s')
        .join('subscription_plans as sp', 's.plan_id', 'sp.id')
        .whereIn('s.status', ['active', 'trialing'])
        .select(
          this.db.raw(`
            SUM(
              CASE 
                WHEN sp.billing_interval = 'year' THEN sp.amount / 12 
                ELSE sp.amount 
              END * s.quantity
            ) as mrr
          `),
        )
        .first();

      const mrr = parseFloat(mrrResult?.mrr || '0');
      const arr = mrr * 12;

      // Calculate churn rate (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const churnedSubscriptions = await this.db('subscriptions')
        .where('status', 'canceled')
        .where('canceled_at', '>=', thirtyDaysAgo)
        .count('id as count')
        .first();

      const totalSubscriptionsStart = await this.db('subscriptions')
        .where('created_at', '<=', thirtyDaysAgo)
        .count('id as count')
        .first();

      const churnedCount = parseInt(churnedSubscriptions?.count || '0');
      const totalAtStart = parseInt(totalSubscriptionsStart?.count || '0');
      const churnRate = totalAtStart > 0 ? (churnedCount / totalAtStart) * 100 : 0;

      return {
        totalRevenue,
        totalCustomers,
        activeSubscriptions,
        churnRate: parseFloat(churnRate.toFixed(2)),
        mrr,
        arr,
      };
    } catch (error) {
      logger.error('Failed to get dashboard metrics:', error);
      throw error;
    }
  }

  async getRecentActivity(limit = 10): Promise<any[]> {
    try {
      const recentSubscriptions = await this.db('subscriptions as s')
        .join('customers as c', 's.customer_id', 'c.id')
        .join('subscription_plans as sp', 's.plan_id', 'sp.id')
        .select(
          's.id',
          'c.name as customer_name',
          'c.email as customer_email',
          'sp.name as plan_name',
          's.status',
          's.created_at',
          this.db.raw("'subscription_created' as activity_type"),
        )
        .orderBy('s.created_at', 'desc')
        .limit(limit);

      const recentPayments = await this.db('invoices as i')
        .join('customers as c', 'i.customer_id', 'c.id')
        .select(
          'i.id',
          'c.name as customer_name',
          'c.email as customer_email',
          'i.amount_paid as amount',
          'i.currency',
          'i.paid_at as created_at',
          this.db.raw("'payment_received' as activity_type"),
        )
        .where('i.status', 'paid')
        .whereNotNull('i.paid_at')
        .orderBy('i.paid_at', 'desc')
        .limit(limit);

      const failedPayments = await this.db('failed_payments as fp')
        .join('customers as c', 'fp.customer_id', 'c.id')
        .select(
          'fp.id',
          'c.name as customer_name',
          'c.email as customer_email',
          'fp.amount',
          'fp.currency',
          'fp.failure_reason',
          'fp.created_at',
          this.db.raw("'payment_failed' as activity_type"),
        )
        .where('fp.resolved', false)
        .orderBy('fp.created_at', 'desc')
        .limit(limit);

      // Combine and sort all activities
      const allActivities = [...recentSubscriptions, ...recentPayments, ...failedPayments].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      return allActivities.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get recent activity:', error);
      throw error;
    }
  }

  async getRevenueChart(period = '30d'): Promise<any[]> {
    try {
      const days = this.parsePeriodToDays(period);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const revenueData = await this.db('invoices')
        .select(
          this.db.raw('DATE(paid_at) as date'),
          this.db.raw('SUM(amount_paid) as revenue'),
          this.db.raw('COUNT(*) as transactions'),
        )
        .where('status', 'paid')
        .where('paid_at', '>=', startDate)
        .whereNotNull('paid_at')
        .groupBy(this.db.raw('DATE(paid_at)'))
        .orderBy('date', 'asc');

      return revenueData.map((item) => ({
        date: item.date,
        revenue: parseFloat(item.revenue),
        transactions: parseInt(item.transactions),
      }));
    } catch (error) {
      logger.error('Failed to get revenue chart data:', error);
      throw error;
    }
  }

  async getRevenueAnalytics(options: { period: string; granularity: string }): Promise<any> {
    try {
      const { period, granularity } = options;
      const days = this.parsePeriodToDays(period);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      let dateFormat: string;
      switch (granularity) {
        case 'day':
          dateFormat = 'DATE(paid_at)';
          break;
        case 'week':
          dateFormat = "DATE_TRUNC('week', paid_at)::date";
          break;
        case 'month':
          dateFormat = "DATE_TRUNC('month', paid_at)::date";
          break;
        default:
          dateFormat = 'DATE(paid_at)';
      }

      const revenueData = await this.db('invoices')
        .select(
          this.db.raw(`${dateFormat} as period`),
          this.db.raw('SUM(amount_paid) as revenue'),
          this.db.raw('COUNT(*) as transactions'),
          this.db.raw('AVG(amount_paid) as avg_transaction_value'),
        )
        .where('status', 'paid')
        .where('paid_at', '>=', startDate)
        .whereNotNull('paid_at')
        .groupBy(this.db.raw(dateFormat))
        .orderBy('period', 'asc');

      const totalRevenue = revenueData.reduce((sum, item) => sum + parseFloat(item.revenue), 0);
      const totalTransactions = revenueData.reduce(
        (sum, item) => sum + parseInt(item.transactions),
        0,
      );

      return {
        summary: {
          totalRevenue,
          totalTransactions,
          averageTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
        },
        chartData: revenueData.map((item) => ({
          period: item.period,
          revenue: parseFloat(item.revenue),
          transactions: parseInt(item.transactions),
          avgTransactionValue: parseFloat(item.avg_transaction_value),
        })),
      };
    } catch (error) {
      logger.error('Failed to get revenue analytics:', error);
      throw error;
    }
  }

  async getSubscriptionAnalytics(options: { period: string }): Promise<SubscriptionAnalytics> {
    try {
      const { period } = options;
      const days = this.parsePeriodToDays(period);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get subscription counts by status
      const subscriptionsByStatus = await this.db('subscriptions')
        .select('status')
        .count('id as count')
        .where('created_at', '>=', startDate)
        .groupBy('status');

      // Get subscription counts by plan type
      const subscriptionsByPlan = await this.db('subscriptions as s')
        .join('subscription_plans as sp', 's.plan_id', 'sp.id')
        .select('sp.plan_type')
        .count('s.id as count')
        .sum('sp.amount as revenue')
        .where('s.created_at', '>=', startDate)
        .groupBy('sp.plan_type');

      // Calculate growth metrics
      const totalSubscriptions = subscriptionsByStatus.reduce(
        (sum, item) => sum + parseInt(item.count),
        0,
      );

      const activeSubscriptions = subscriptionsByStatus
        .filter((item) => ['active', 'trialing'].includes(item.status))
        .reduce((sum, item) => sum + parseInt(item.count), 0);

      const churned = subscriptionsByStatus
        .filter((item) => ['canceled', 'unpaid'].includes(item.status))
        .reduce((sum, item) => sum + parseInt(item.count), 0);

      const churnRate = totalSubscriptions > 0 ? (churned / totalSubscriptions) * 100 : 0;

      // Calculate LTV (simplified)
      const avgRevenuePerSubscription =
        subscriptionsByPlan.reduce((sum, item) => sum + parseFloat(item.revenue), 0) /
        Math.max(totalSubscriptions, 1);

      const avgLifetimeMonths = 24; // Simplified assumption
      const ltv = avgRevenuePerSubscription * avgLifetimeMonths;

      return {
        total_subscriptions: totalSubscriptions,
        active_subscriptions: activeSubscriptions,
        churned_subscriptions: churned,
        mrr: 0, // Calculate separately
        arr: 0, // Calculate separately
        churn_rate: parseFloat(churnRate.toFixed(2)),
        growth_rate: 0, // Would need historical data to calculate
        ltv: parseFloat(ltv.toFixed(2)),
        by_plan: subscriptionsByPlan.reduce((acc, item) => {
          acc[item.plan_type] = {
            count: parseInt(item.count),
            revenue: parseFloat(item.revenue),
          };
          return acc;
        }, {} as any),
      };
    } catch (error) {
      logger.error('Failed to get subscription analytics:', error);
      throw error;
    }
  }

  async getUsageAnalytics(options: { period: string }): Promise<UsageAnalytics> {
    try {
      const { period } = options;
      const days = this.parsePeriodToDays(period);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get total usage
      const totalUsageResult = await this.db('usage_records')
        .sum('quantity as total')
        .where('timestamp', '>=', startDate)
        .first();

      const totalUsage = parseInt(totalUsageResult?.total || '0');

      // Get average usage per customer
      const avgUsageResult = await this.db('usage_records')
        .select('customer_id')
        .sum('quantity as total')
        .where('timestamp', '>=', startDate)
        .groupBy('customer_id');

      const avgUsagePerCustomer =
        avgUsageResult.length > 0
          ? avgUsageResult.reduce((sum, item) => sum + parseInt(item.total), 0) /
            avgUsageResult.length
          : 0;

      // Get peak usage day
      const peakUsageDayResult = await this.db('usage_records')
        .select(this.db.raw('DATE(timestamp) as date'))
        .sum('quantity as total')
        .where('timestamp', '>=', startDate)
        .groupBy(this.db.raw('DATE(timestamp)'))
        .orderBy('total', 'desc')
        .first();

      const peakUsageDay = peakUsageDayResult?.date || null;

      // Get usage by metric
      const usageByMetric = await this.db('usage_records')
        .select('metric_name')
        .sum('quantity as total')
        .avg('quantity as average')
        .max('quantity as peak')
        .where('timestamp', '>=', startDate)
        .groupBy('metric_name');

      // Calculate growth rate (simplified - compare with previous period)
      const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);
      const previousUsageResult = await this.db('usage_records')
        .sum('quantity as total')
        .where('timestamp', '>=', previousStartDate)
        .where('timestamp', '<', startDate)
        .first();

      const previousUsage = parseInt(previousUsageResult?.total || '0');
      const usageGrowthRate =
        previousUsage > 0 ? ((totalUsage - previousUsage) / previousUsage) * 100 : 0;

      return {
        total_usage: totalUsage,
        average_usage_per_customer: parseFloat(avgUsagePerCustomer.toFixed(2)),
        peak_usage_day: peakUsageDay,
        usage_growth_rate: parseFloat(usageGrowthRate.toFixed(2)),
        by_metric: usageByMetric.reduce((acc, item) => {
          acc[item.metric_name] = {
            total: parseInt(item.total),
            average: parseFloat(item.average),
            peak: parseInt(item.peak),
          };
          return acc;
        }, {} as any),
      };
    } catch (error) {
      logger.error('Failed to get usage analytics:', error);
      throw error;
    }
  }

  async getCustomerSegmentation(): Promise<any> {
    try {
      // Segment customers by subscription type
      const customersByPlan = await this.db('customers as c')
        .leftJoin('subscriptions as s', 'c.id', 's.customer_id')
        .leftJoin('subscription_plans as sp', 's.plan_id', 'sp.id')
        .select('sp.plan_type')
        .count('c.id as count')
        .whereNull('c.deleted_at')
        .whereIn('s.status', ['active', 'trialing'])
        .groupBy('sp.plan_type');

      // Segment customers by usage
      const customersByUsage = await this.db.raw(`
        SELECT 
          CASE 
            WHEN total_usage = 0 THEN 'inactive'
            WHEN total_usage <= 1000 THEN 'light'
            WHEN total_usage <= 10000 THEN 'moderate'
            ELSE 'heavy'
          END as usage_segment,
          COUNT(*) as count
        FROM (
          SELECT 
            ur.customer_id,
            COALESCE(SUM(ur.quantity), 0) as total_usage
          FROM customers c
          LEFT JOIN usage_records ur ON c.id = ur.customer_id 
            AND ur.timestamp >= NOW() - INTERVAL '30 days'
          WHERE c.deleted_at IS NULL
          GROUP BY ur.customer_id
        ) usage_data
        GROUP BY usage_segment
      `);

      return {
        byPlan: customersByPlan,
        byUsage: customersByUsage.rows,
      };
    } catch (error) {
      logger.error('Failed to get customer segmentation:', error);
      throw error;
    }
  }

  async getCohortAnalysis(startDate: Date, endDate: Date): Promise<any> {
    try {
      // Get customer cohorts by signup month
      const cohorts = await this.db.raw(
        `
        SELECT 
          DATE_TRUNC('month', c.created_at) as cohort_month,
          COUNT(DISTINCT c.id) as total_customers,
          COUNT(DISTINCT CASE WHEN s.status IN ('active', 'trialing') THEN c.id END) as active_customers,
          AVG(
            CASE WHEN s.status IN ('active', 'trialing') THEN sp.amount ELSE 0 END
          ) as avg_revenue_per_customer
        FROM customers c
        LEFT JOIN subscriptions s ON c.id = s.customer_id
        LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE c.created_at BETWEEN $1 AND $2
          AND c.deleted_at IS NULL
        GROUP BY DATE_TRUNC('month', c.created_at)
        ORDER BY cohort_month
      `,
        [startDate, endDate],
      );

      return cohorts.rows.map((row) => ({
        cohortMonth: row.cohort_month,
        totalCustomers: parseInt(row.total_customers),
        activeCustomers: parseInt(row.active_customers),
        retentionRate:
          row.total_customers > 0
            ? (parseInt(row.active_customers) / parseInt(row.total_customers)) * 100
            : 0,
        avgRevenuePerCustomer: parseFloat(row.avg_revenue_per_customer || '0'),
      }));
    } catch (error) {
      logger.error('Failed to get cohort analysis:', error);
      throw error;
    }
  }

  async getRevenueForecasting(months = 12): Promise<any> {
    try {
      // Get historical MRR data for the last 12 months
      const historicalMRR = await this.db.raw(`
        SELECT 
          DATE_TRUNC('month', s.created_at) as month,
          SUM(
            CASE 
              WHEN sp.billing_interval = 'year' THEN sp.amount / 12 
              ELSE sp.amount 
            END * s.quantity
          ) as mrr
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.status IN ('active', 'trialing')
          AND s.created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', s.created_at)
        ORDER BY month
      `);

      const mrrData = historicalMRR.rows.map((row) => ({
        month: row.month,
        mrr: parseFloat(row.mrr || '0'),
      }));

      // Simple linear regression for forecasting
      const forecast = this.calculateLinearForecast(mrrData, months);

      return {
        historical: mrrData,
        forecast,
      };
    } catch (error) {
      logger.error('Failed to get revenue forecasting:', error);
      throw error;
    }
  }

  private parsePeriodToDays(period: string): number {
    switch (period) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
      case '1y':
        return 365;
      default:
        return 30;
    }
  }

  private calculateLinearForecast(data: any[], months: number): any[] {
    if (data.length < 2) {
      return [];
    }

    // Calculate linear trend
    const n = data.length;
    const sumX = data.reduce((sum, _, index) => sum + index, 0);
    const sumY = data.reduce((sum, item) => sum + item.mrr, 0);
    const sumXY = data.reduce((sum, item, index) => sum + index * item.mrr, 0);
    const sumXX = data.reduce((sum, _, index) => sum + index * index, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate forecast
    const forecast = [];
    const lastMonth = new Date(data[data.length - 1].month);

    for (let i = 1; i <= months; i++) {
      const forecastMonth = new Date(lastMonth);
      forecastMonth.setMonth(forecastMonth.getMonth() + i);

      const forecastValue = slope * (n + i - 1) + intercept;

      forecast.push({
        month: forecastMonth,
        mrr: Math.max(0, forecastValue), // Ensure non-negative
        isForecasted: true,
      });
    }

    return forecast;
  }
}

export const analyticsService = new AnalyticsService();
