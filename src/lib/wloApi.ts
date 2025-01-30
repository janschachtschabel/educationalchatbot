import axios from 'axios';

export interface WLOSearchParams {
  properties: string[];
  values: string[];
  maxItems?: number;
  skipCount?: number;
  propertyFilter?: string;
  combineMode?: 'OR' | 'AND';
  signal?: AbortSignal;
}

export async function searchWLO({
  properties,
  values,
  maxItems = 5,
  skipCount = 0,
  propertyFilter = '-all-',
  combineMode = 'AND',
  signal
}: WLOSearchParams) {
  try {
    // Construct the search criteria array
    const criteria = [];
    
    // Add title/search word as first criterion
    if (properties.includes('cclom:title') && values[0]) {
      criteria.push({
        property: 'ngsearchword',
        values: [values[0]]
      });
    }

    // Map old property names to new ones
    const propertyMapping: Record<string, string> = {
      'ccm:oeh_lrt_aggregated': 'ccm:oeh_lrt_aggregated',
      'ccm:taxonid': 'virtual:taxonid',
      'ccm:educationalcontext': 'ccm:educationalcontext'
    };

    // Add remaining criteria with mapped properties
    for (let i = 0; i < properties.length; i++) {
      if (properties[i] !== 'cclom:title' && values[i]) {
        criteria.push({
          property: propertyMapping[properties[i]] || properties[i],
          values: [values[i]]
        });
      }
    }

    const searchParams = new URLSearchParams({
      contentType: 'FILES',
      maxItems: maxItems.toString(),
      skipCount: skipCount.toString(),
      propertyFilter
    });

    const url = `/api/edu-sharing/rest/search/v1/queries/-home-/mds_oeh/ngsearch?${searchParams}`;

    const response = await axios.post(
      url,
      { criteria },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'WLO-KI-Editor'
        },
        signal
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('WLO API error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`WLO API request failed: ${error.message}`);
    } else {
      console.error('Unknown error:', error);
      throw new Error('WLO API request failed: Unknown error occurred');
    }
  }
}