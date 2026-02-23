import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getAllCompanies,
  getJobsByCompany,
  getFundingByCompany,
} from '../server/db/store.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { funding_stage, vc, remote, company_size } = req.query as Record<string, string>;

    let companies = getAllCompanies();
    const companyJobsMap = new Map<number, ReturnType<typeof getJobsByCompany>>();
    companies = companies.filter(c => {
      const jobs = getJobsByCompany(c.id);
      if (jobs.length === 0) return false;
      companyJobsMap.set(c.id, jobs);
      return true;
    });

    if (funding_stage) {
      const stages = funding_stage.split(',').map(s => s.trim().toLowerCase());
      companies = companies.filter(c =>
        c.funding_stage != null && stages.includes(c.funding_stage.toLowerCase())
      );
    }

    if (vc) {
      const vcs = vc.split(',').map(v => v.trim().toLowerCase());
      companies = companies.filter(c => {
        try {
          const investors = JSON.parse(c.investors || '[]') as string[];
          return vcs.some(v => investors.some(inv => inv.toLowerCase().includes(v)));
        } catch { return false; }
      });
    }

    if (remote === 'true') {
      companies = companies.filter(c => {
        const jobs = companyJobsMap.get(c.id) || [];
        return jobs.some(j => j.remote_type === 'remote');
      });
    }

    if (company_size) {
      const sizes = company_size.split(',');
      companies = companies.filter(c => sizes.some(size => {
        const [min, max] = size.split('-').map(Number);
        if (min && max) {
          return (c.headcount_min != null && c.headcount_min >= min) &&
                 (c.headcount_max != null && c.headcount_max <= max);
        }
        return false;
      }));
    }

    const scored = companies.map(c => {
      const jobs = companyJobsMap.get(c.id) || [];
      const activeJobs = jobs.length;

      const activeJobsScore = Math.min(activeJobs / 20, 1) * 25;

      let fundingScore = 0;
      const fundingEvents = getFundingByCompany(c.id);
      const latestFundingDate = fundingEvents
        .filter(fe => fe.date != null).map(fe => fe.date!).sort().pop();
      if (latestFundingDate) {
        const daysSinceFunding = (Date.now() - new Date(latestFundingDate).getTime()) / 86400000;
        fundingScore = Math.max(0, 1 - daysSinceFunding / 180) * 25;
      }

      const avgJobAgeDays = jobs.reduce((sum, j) => {
        return sum + (j.posted_at
          ? (Date.now() - new Date(j.posted_at).getTime()) / 86400000
          : 30);
      }, 0) / (activeJobs || 1);
      const freshnessScore = Math.max(0, 1 - avgJobAgeDays / 60) * 20;

      const sourceCount = new Set(jobs.map(j => j.source)).size;
      const sourceScore = Math.min(sourceCount / 4, 1) * 15;

      const jobsWithSalary = jobs.filter(j => j.salary_min != null).length;
      const jobsWithDesc = jobs.filter(j => j.description != null && j.description.length > 100).length;
      const completeness = (jobsWithSalary / (activeJobs || 1)) * 0.5 +
                            (jobsWithDesc / (activeJobs || 1)) * 0.5;
      const completenessScore = completeness * 15;

      const totalScore = activeJobsScore + fundingScore + freshnessScore + sourceScore + completenessScore;

      const reasons: string[] = [];
      if (activeJobs >= 10) reasons.push(`Actively hiring with ${activeJobs} open roles`);
      else if (activeJobs >= 3) reasons.push(`${activeJobs} open positions`);
      if (fundingScore > 15) reasons.push('Recently funded — likely in growth mode');
      if (sourceCount >= 3) reasons.push(`Listed on ${sourceCount} job sources`);
      if (avgJobAgeDays < 7) reasons.push('Posting new jobs frequently');
      if (c.funding_stage) reasons.push(`${c.funding_stage} stage`);

      return {
        company: { ...c, investors: JSON.parse(c.investors || '[]') },
        score: Math.round(totalScore * 10) / 10,
        reasons,
        active_jobs_count: activeJobs,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const top10 = scored.slice(0, 10);

    const recommendations = top10.map(rec => {
      const recentJobs = (companyJobsMap.get(rec.company.id) || [])
        .sort((a, b) => (b.posted_at || '').localeCompare(a.posted_at || ''))
        .slice(0, 5)
        .map(j => ({
          id: j.id, title: j.title, location: j.location,
          remote_type: j.remote_type, posted_at: j.posted_at,
          salary_min: j.salary_min, salary_max: j.salary_max,
        }));
      return { ...rec, recent_jobs: recentJobs };
    });

    return res.json({ recommendations });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to generate recommendations' });
  }
}
