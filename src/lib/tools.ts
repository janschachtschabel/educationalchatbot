import { supabase } from './supabase';
import axios from 'axios';

interface WLOResource {
  id: string;
  name: string;
  properties: {
    'cclom:title'?: string[];
    'cclom:general_description'?: string[];
    'ccm:wwwurl'?: string[];
    'ccm:taxonid_DISPLAYNAME'?: string[];
    'ccm:educationalcontext_DISPLAYNAME'?: string[];
    'ccm:oeh_lrt_aggregated_DISPLAYNAME'?: string[];
  };
  preview?: {
    url: string;
  };
}

export const tools = {
  async wloSearch(query: string, language: string = 'de'): Promise<WLOResource[]> {
    try {
      const response = await axios.post('/api/edu-sharing/rest/search/v1/queries/-home-/mds_oeh/ngsearch', {
        criteria: [{
          property: 'ngsearchword',
          values: [query]
        }],
        maxItems: 10,
        skipCount: 0,
        propertyFilter: '-all-'
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'WLO-KI-Editor'
        }
      });

      if (!response.data?.nodes) {
        return [];
      }

      // Transform and serialize the response data
      return response.data.nodes.map((node: any) => {
        // Extract only the necessary properties to avoid serialization issues
        const properties = {
          'cclom:title': node.properties['cclom:title'] || [],
          'cclom:general_description': node.properties['cclom:general_description'] || [],
          'ccm:wwwurl': node.properties['ccm:wwwurl'] || [],
          'ccm:taxonid_DISPLAYNAME': node.properties['ccm:taxonid_DISPLAYNAME'] || [],
          'ccm:educationalcontext_DISPLAYNAME': node.properties['ccm:educationalcontext_DISPLAYNAME'] || [],
          'ccm:oeh_lrt_aggregated_DISPLAYNAME': node.properties['ccm:oeh_lrt_aggregated_DISPLAYNAME'] || []
        };

        // Create a clean, serializable object
        return {
          id: node.ref.id,
          name: properties['cclom:title'][0] || 'Untitled',
          properties,
          preview: node.preview ? {
            url: node.preview.url
          } : undefined
        };
      });
    } catch (error) {
      console.error('WLO search error:', error);
      throw new Error(language === 'de' 
        ? 'Fehler bei der WLO-Suche'
        : 'Error searching WLO resources');
    }
  }
};