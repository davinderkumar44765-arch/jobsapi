import express from 'express';
import axios from 'axios';
import ExcelJS from 'exceljs';
import dotenv from 'dotenv'
dotenv.config()
const app = express();
const port = 3000;

// Your API keys rotation setup (update with your keys)
const apiKeys = [
  process.env.KEY1,
  process.env.KEY2,
  process.env.KEY3,
  // Add more keys here
];
let currentKeyIndex = 0;
function getNextApiKey() {
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  return key;
}

// Helper to get date string for 1 day ago (YYYY-MM-DD)
function getOneDayOldDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}
function getYesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
// Existing APIs + New POST API service with normalize
const apiServices = [
  {
    name: 'JobsAPI19', // New API you provided
    method: 'GET',
    url: 'https://jobs-api19.p.rapidapi.com/jobs',
    params: { limit: '50' }, // can increase limit to get enough jobs for filtering
    normalize: (job) => ({
      id: job.id,
      title: job.title,
      organization: job.company,
      location: job.location,
      url: job.apply_link,
      description: job.job_description || '',
      date_posted: job.posted_date,
      employment_type: job.job_type || '',
      salary: job.salary || '',
      category: job.category || '',
      remote_onsite: job.remote_onsite || '',
      contact_email: job.contact_email || '',
      source: 'JobsAPI19',
    }),
    filter: (jobs) => {
      const today = getTodayDate();
      const yesterday = getYesterdayDate();
      return jobs.filter((job) => {
        const dateStr = job.posted_date?.split('T')[0];
        console.log(dateStr,"-->",today,"-->",yesterday);
        
        return dateStr == today || dateStr == yesterday;
      });
    },
  },
  {
    name: 'JSearchJobs',
    method: 'GET',
    url: 'https://jsearch.p.rapidapi.com/search',
    params: {
      query: 'software',
      page: '1',
      num_pages: '1',
      country: 'in',
      date_posted: 'today',
      job_requirements: 'no_experience',
    },
    normalize: (job) => ({
      id: job.job_id,
      title: job.job_title,
      organization: job.employer_name,
      location: job.job_location,
      url: job.job_apply_link,
      description: job.job_description,
      date_posted: job.job_posted_at_datetime_utc,
      employment_type: job.job_employment_types?.join(', ') || '',
      salary: job.salary || '',
      category: job.category || '',
      remote_onsite: job.remote_onsite || '',
      contact_email: job.contact_email || '',
      source: 'JSearch',
    }),
  },
  // {
  //   name: 'ActiveJobsDB',
  //   method: 'GET',
  //   url: 'https://active-jobs-db.p.rapidapi.com/active-ats-24h',
  //   params: {
  //     limit: '50',
  //     offset: '0',
  //     title_filter: '"Software"',
  //     advanced_title_filter: 'Software Developer | Software Engineer | Web Developer | App Developer',
  //     location_filter: '"India"',
  //     description_type: 'text',
  //     date_filter: getOneDayOldDate(),
  //     ai_experience_level_filter: '0-2',
  //   },
  //   normalize: (job) => ({
  //     id: job.id,
  //     title: job.title,
  //     organization: job.organization,
  //     location: job.locations_derived?.join(', ') || '',
  //     url: job.url,
  //     description: job.description_text,
  //     date_posted: job.date_posted,
  //     employment_type: job.employment_type?.join(', ') || '',
  //     salary: job.salary || '',
  //     category: job.category || '',
  //     remote_onsite: job.remote_onsite || '',
  //     contact_email: job.contact_email || '',
  //     source: 'ActiveJobsDB',
  //   }),
  // },
  {
    name: 'LinkedInJobs',
    method: 'GET',
    url: 'https://linkedin-job-search-api.p.rapidapi.com/active-jb-24h',
    params: {
      limit: '50',
      offset: '0',
      title_filter: '"Software"',
      location_filter: '"India"',
      date_filter: getOneDayOldDate(),
      ai_experience_level_filter: '0-2',
    },
    normalize: (job) => ({
      id: job.id,
      title: job.title,
      organization: job.organization,
      location: job.locations_derived?.join(', ') || '',
      url: job.url,
      description: job.description_text,
      date_posted: job.date_posted,
      employment_type: job.employment_type?.join(', ') || '',
      salary: job.salary || '',
      category: job.category || '',
      remote_onsite: job.remote_onsite || '',
      contact_email: job.contact_email || '',
      source: 'LinkedInJobs',
    }),
  },
  // {
  //   name: 'JobsSearchAPI',
  //   method: 'POST',
  //   url: 'https://jobs-search-api.p.rapidapi.com/getjobs',
  //   // No URL params, use data in POST body
  //   postData: {
  //     search_term: 'software',
  //     location: 'india',
  //     results_wanted: 50,
  //     site_name: [
  //       'indeed',
  //       'linkedin',
  //       'zip_recruiter',
  //       'glassdoor',
  //     ],
  //     distance: 10000,
  //     job_type: 'fulltime',
  //     is_remote: false,
  //     linkedin_fetch_description: false,
  //     hours_old: 24,
  //   },
  //   normalize: (job) => ({
  //     id: job.id,
  //     title: job.title,
  //     organization: job.company,
  //     location: job.location,
  //     url: job.job_url,
  //     description: job.description || '',
  //     date_posted: job.date_posted,
  //     employment_type: job.job_type || '',
  //     salary: job.salary_source || '',
  //     category: job.job_function || '',
  //     remote_onsite: job.is_remote === "True" ? "Remote" : "Onsite",
  //     contact_email: job.emails || 'N/A',
  //     source: job.site || 'JobsSearchAPI',
  //   }),
  // },
];

// Function to call each API with rotating keys
async function callApiService(service) {
  const apiKey = getNextApiKey();

  try {
    let response;
    if (service.method === 'POST') {
      response = await axios.post(service.url, service.postData, {
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': new URL(service.url).host,
          'Content-Type': 'application/json',
        },
      });
    } else {
      // GET request
      response = await axios.get(service.url, {
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': new URL(service.url).host,
        },
        params: service.params,
      });
    }

    // Extract job list based on service response format
    let jobsRaw = [];

    if (service.name === 'JobsSearchAPI') {
      jobsRaw = response.data.jobs || [];
    } else {
      jobsRaw = response.data.data || response.data || [];
    }

    // Normalize jobs
    const jobs = Array.isArray(jobsRaw)
      ? jobsRaw.map(service.normalize)
      : [];

    return { service: service.name, data: jobs };
  } catch (error) {
    console.error(`Error calling ${service.name}:`, error.message);
    return { service: service.name, data: [], error: error.message };
  }
}

// Fallback for missing fields
function extractExtraFields(job) {
  return {
    experience_required: job.employment_type || 'Not specified',
    salary: job.salary || 'Not specified',
    category: job.category || 'Software',
    remote_onsite: job.remote_onsite || 'Not specified',
    contact_email: job.contact_email || 'N/A',
  };
}

app.get('/combined-jobs', async (req, res) => {
  try {
    const results = await Promise.all(apiServices.map(callApiService));
    const combinedJobs = results.reduce((acc, curr) => acc.concat(curr.data), []);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Jobs');

    worksheet.columns = [
      { header: 'Job Title', key: 'title', width: 30 },
      { header: 'Company Name', key: 'organization', width: 25 },
      { header: 'Location', key: 'location', width: 25 },
      { header: 'Job Type', key: 'employment_type', width: 20 },
      { header: 'Experience Required', key: 'experience_required', width: 20 },
      { header: 'Salary', key: 'salary', width: 20 },
      { header: 'Posted Date', key: 'date_posted', width: 20 },
      { header: 'Apply Link', key: 'url', width: 50 },
      { header: 'Job Description', key: 'description', width: 50 },
      { header: 'Job ID', key: 'id', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Remote/Onsite', key: 'remote_onsite', width: 15 },
      { header: 'Contact Email', key: 'contact_email', width: 25 },
       { header: 'Source', key: 'source', width: 20 },
    ];

    combinedJobs.forEach(job => {
      const extra = extractExtraFields(job);
      worksheet.addRow({
        ...job,
        ...extra,
         source: job.source || 'Unknown',
      });
    });

    const fileName = `${new Date().toISOString().slice(0, 10)}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    res.send(buffer);
  } catch (err) {
    console.error('Error generating Excel:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch or generate Excel file',
      error: err.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
