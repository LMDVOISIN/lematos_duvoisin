import { supabase } from '../lib/supabase';

const normalizeMirrorScenarioFields = (scenarioData = {}) => ({
  mirror_group_key: scenarioData?.mirrorGroupKey?.trim() || null,
  mirror_role: scenarioData?.mirrorRole || null,
  program_family: scenarioData?.programFamily || null
});

const userTestingService = {
  // ============ USER TESTERS ============
  
  async checkIfTester(email) {
    try {
      const { data, error } = await supabase?.from('user_testers')?.select('*')?.eq('email', email)?.eq('is_active', true)?.maybeSingle();

      if (error && error?.code !== 'PGRST116') throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createTester(testerData) {
    try {
      const { data, error } = await supabase?.from('user_testers')?.insert({
          email: testerData?.email,
          protocol_group: testerData?.protocolGroup,
          system: testerData?.system,
          screen_type: testerData?.screenType,
          browser: testerData?.browser,
          is_active: true
        })?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateTesterContext(testerId, contextData) {
    try {
      const { data, error } = await supabase?.from('user_testers')?.update({
          system: contextData?.system,
          screen_type: contextData?.screenType,
          browser: contextData?.browser
        })?.eq('id', testerId)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getAllTesters() {
    try {
      const { data, error } = await supabase?.from('user_testers')?.select('*')?.order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [], error };
    }
  },

  async toggleTesterStatus(testerId, isActive) {
    try {
      const { data, error } = await supabase?.from('user_testers')?.update({ is_active: isActive })?.eq('id', testerId)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // ============ TEST SCENARIOS ============
  
  async getActiveScenarios() {
    try {
      const { data, error } = await supabase?.from('test_scenarios')?.select('*')?.eq('is_active', true)?.order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [], error };
    }
  },

  async getAllScenarios() {
    try {
      const { data, error } = await supabase?.from('test_scenarios')?.select('*')?.order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [], error };
    }
  },

  async getMirrorStartState(testerId) {
    try {
      const { data, error } = await supabase?.rpc('get_test_mirror_start_state', {
        p_tester_id: testerId
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getScenarioById(scenarioId) {
    try {
      const { data, error } = await supabase?.from('test_scenarios')?.select('*')?.eq('id', scenarioId)?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createScenario(scenarioData) {
    try {
      const { data, error } = await supabase?.from('test_scenarios')?.insert({
          title: scenarioData?.title,
          objective: scenarioData?.objective,
          expected_result: scenarioData?.expectedResult,
          instructions: scenarioData?.instructions,
          pages: scenarioData?.pages,
          is_active: Boolean(scenarioData?.isActive),
          ...normalizeMirrorScenarioFields(scenarioData)
        })?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateScenario(scenarioId, scenarioData) {
    try {
      const { data, error } = await supabase?.from('test_scenarios')?.update({
          title: scenarioData?.title,
          objective: scenarioData?.objective,
          expected_result: scenarioData?.expectedResult,
          instructions: scenarioData?.instructions,
          pages: scenarioData?.pages,
          is_active: scenarioData?.isActive,
          ...normalizeMirrorScenarioFields(scenarioData),
          updated_at: new Date()?.toISOString()
        })?.eq('id', scenarioId)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async deleteScenario(scenarioId) {
    try {
      const { error } = await supabase?.from('test_scenarios')?.delete()?.eq('id', scenarioId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // ============ TEST SESSIONS ============
  
  async createSession(testerId, scenarioId) {
    return userTestingService?.startMirrorSession(testerId, scenarioId);
  },

  async startMirrorSession(testerId, selectedReferenceScenarioId = null) {
    try {
      const { data, error } = await supabase?.rpc('start_test_mirror_session', {
        p_tester_id: testerId,
        p_selected_reference_scenario_id: selectedReferenceScenarioId || null
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getCurrentSession(testerId) {
    try {
      const { data, error } = await supabase?.from('test_sessions')?.select(`
          *,
          scenario:test_scenarios(*),
          tester:user_testers(*)
        `)?.eq('tester_id', testerId)?.eq('status', 'in_progress')?.order('started_at', { ascending: false })?.limit(1)?.maybeSingle();

      if (error && error?.code !== 'PGRST116') throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async completeSession(sessionId, debriefData) {
    try {
      // Update session status
      const { error: sessionError } = await supabase?.from('test_sessions')?.update({
          status: 'completed',
          completed_at: new Date()?.toISOString()
        })?.eq('id', sessionId);

      if (sessionError) throw sessionError;

      // Create debrief note
      const { data, error: debriefError } = await supabase?.from('debrief_notes')?.insert({
          session_id: sessionId,
          what_was_clear: debriefData?.whatWasClear,
          what_blocked: debriefData?.whatBlocked,
          confidence_level: debriefData?.confidenceLevel,
          notes: debriefData?.notes
        })?.select()?.single();

      if (debriefError) throw debriefError;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getAllSessions() {
    try {
      const { data, error } = await supabase?.from('test_sessions')?.select(`
          *,
          tester:user_testers(email, system, screen_type, browser),
          scenario:test_scenarios(title, objective)
        `)?.order('started_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [], error };
    }
  },

  async getCurrentMirrorCampaignSummary() {
    try {
      let { data: campaign, error: campaignError } = await supabase?.from('test_mirror_campaigns')?.select('*')?.eq('is_current', true)?.order('created_at', { ascending: false })?.limit(1)?.maybeSingle();

      if (campaignError && campaignError?.code !== 'PGRST116') throw campaignError;

      let rounds = [];

      if (campaign?.id) {
        const { data: roundsData, error: roundsError } = await supabase?.from('test_mirror_rounds')?.select('*')?.eq('campaign_id', campaign?.id)?.order('round_number', { ascending: true });

        if (roundsError) throw roundsError;
        rounds = roundsData || [];
      }

      return {
        data: {
          campaign: campaign || null,
          rounds
        },
        error: null
      };
    } catch (error) {
      return {
        data: {
          campaign: null,
          rounds: []
        },
        error
      };
    }
  },

  async startNewMirrorCampaign(label = '') {
    try {
      const { data, error } = await supabase?.rpc('start_new_test_mirror_campaign', {
        p_label: label?.trim() || null
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // ============ PAGE RESPONSES ============
  
  async savePageResponse(responseData) {
    try {
      const { data, error } = await supabase?.from('page_responses')?.insert({
          session_id: responseData?.sessionId,
          page_url: responseData?.pageUrl,
          coherence_question: responseData?.coherenceQuestion,
          coherence_answer: responseData?.coherenceAnswer,
          exit_questionnaire: responseData?.exitQuestionnaire,
          perceived_info: responseData?.perceivedInfo,
          next_action_understood: responseData?.nextActionUnderstood,
          time_spent_seconds: responseData?.timeSpentSeconds
        })?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getPageResponsesBySession(sessionId) {
    try {
      const { data, error } = await supabase?.from('page_responses')?.select('*')?.eq('session_id', sessionId)?.order('timestamp', { ascending: true });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [], error };
    }
  },

  async updatePageResponse(responseId, responseData) {
    try {
      const { data, error } = await supabase?.from('page_responses')?.update({
          exit_questionnaire: responseData?.exitQuestionnaire,
          perceived_info: responseData?.perceivedInfo,
          next_action_understood: responseData?.nextActionUnderstood,
          time_spent_seconds: responseData?.timeSpentSeconds
        })?.eq('id', responseId)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getConfusionMap() {
    try {
      const { data, error } = await supabase?.from('page_responses')?.select('page_url, coherence_answer, next_action_understood');

      if (error) throw error;

      // Calculate confusion scores per page
      const confusionMap = {};
      data?.forEach(response => {
        if (!confusionMap?.[response?.page_url]) {
          confusionMap[response.page_url] = {
            total: 0,
            negative: 0,
            unclear: 0
          };
        }
        confusionMap[response.page_url].total++;
        
        // Check for negative coh?rence answers
        const answer = response?.coherence_answer?.toLowerCase() || '';
        if (answer?.includes('non') || answer?.includes('pas') || answer?.includes('difficile')) {
          confusionMap[response.page_url].negative++;
        }
        
        // Check for unclear next actions
        if (response?.next_action_understood === false) {
          confusionMap[response.page_url].unclear++;
        }
      });

      // Calculate percentages
      const result = Object.entries(confusionMap)?.map(([url, stats]) => ({
        pageUrl: url,
        totalResponses: stats?.total,
        confusionScore: Math.round((stats?.negative / stats?.total) * 100),
        unclearNextAction: Math.round((stats?.unclear / stats?.total) * 100)
      }));

      return { data: result, error: null };
    } catch (error) {
      return { data: [], error };
    }
  },

  // ============ TEST REPORTS ============
  
  async createReport(reportData) {
    try {
      const { data, error } = await supabase?.from('test_reports')?.insert({
          session_id: reportData?.sessionId,
          page_url: reportData?.pageUrl,
          severity: reportData?.severity,
          description: reportData?.description,
          reproduction_steps: reportData?.reproductionSteps,
          screenshot_urls: reportData?.screenshotUrls || []
        })?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getAllReports() {
    try {
      const { data, error } = await supabase?.from('test_reports')?.select(`
          *,
          session:test_sessions(
            id,
            tester:user_testers(email),
            scenario:test_scenarios(title)
          )
        `)?.order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [], error };
    }
  },

  // ============ EMERGENCY HELP CHAT ============

  async getLatestEmergencyRequestForSession(sessionId) {
    try {
      const baseQuery = () => supabase?.from('test_emergency_requests')?.select(`
          *,
          session:test_sessions(
            id,
            tester:user_testers(email, protocol_group, system, screen_type, browser),
            scenario:test_scenarios(title, objective)
          )
        `)?.eq('session_id', sessionId)?.order('last_message_at', { ascending: false })?.limit(1);

      let { data, error } = await baseQuery()?.neq('status', 'resolved')?.maybeSingle();

      if (!data && (!error || error?.code === 'PGRST116')) {
        const fallbackResult = await baseQuery()?.maybeSingle();
        data = fallbackResult?.data;
        error = fallbackResult?.error;
      }

      if (error && error?.code !== 'PGRST116') throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getAllEmergencyRequests() {
    try {
      const { data, error } = await supabase?.from('test_emergency_requests')?.select(`
          *,
          session:test_sessions(
            id,
            started_at,
            completed_at,
            tester:user_testers(email, protocol_group, system, screen_type, browser),
            scenario:test_scenarios(title, objective)
          )
        `)?.order('last_message_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [], error };
    }
  },

  async getEmergencyRequestMessages(requestId) {
    try {
      const { data, error } = await supabase?.from('test_emergency_messages')?.select('*')?.eq('request_id', requestId)?.order('created_at', { ascending: true });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [], error };
    }
  },

  async createEmergencyRequest(requestData) {
    try {
      const { data: authData } = await supabase?.auth?.getUser();
      const senderUserId = authData?.user?.id || null;

      const { data: request, error: requestError } = await supabase?.from('test_emergency_requests')?.insert({
          session_id: requestData?.sessionId,
          page_url: requestData?.pageUrl,
          status: 'open'
        })?.select(`
          *,
          session:test_sessions(
            id,
            tester:user_testers(email, protocol_group, system, screen_type, browser),
            scenario:test_scenarios(title, objective)
          )
        `)?.single();

      if (requestError) throw requestError;

      const { data: message, error: messageError } = await supabase?.from('test_emergency_messages')?.insert({
          request_id: request?.id,
          sender_role: 'participant',
          sender_user_id: senderUserId,
          content: requestData?.content
        })?.select()?.single();

      if (messageError) throw messageError;

      return { data: { request, message }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async sendEmergencyMessage(requestId, content, senderRole = 'participant') {
    try {
      const { data: authData } = await supabase?.auth?.getUser();
      const senderUserId = authData?.user?.id || null;

      const { data, error } = await supabase?.from('test_emergency_messages')?.insert({
          request_id: requestId,
          sender_role: senderRole,
          sender_user_id: senderUserId,
          content
        })?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateEmergencyRequestStatus(requestId, status) {
    try {
      const updates = { status };

      if (status === 'observer_joined') {
        updates.observer_joined_at = new Date()?.toISOString();
      }

      if (status === 'resolved') {
        updates.resolved_at = new Date()?.toISOString();
      } else {
        updates.resolved_at = null;
      }

      const { data, error } = await supabase?.from('test_emergency_requests')?.update(updates)?.eq('id', requestId)?.select(`
          *,
          session:test_sessions(
            id,
            started_at,
            completed_at,
            tester:user_testers(email, protocol_group, system, screen_type, browser),
            scenario:test_scenarios(title, objective)
          )
        `)?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getReportsBySeverity(severity) {
    try {
      const { data, error } = await supabase?.from('test_reports')?.select(`
          *,
          session:test_sessions(
            tester:user_testers(email),
            scenario:test_scenarios(title)
          )
        `)?.eq('severity', severity)?.order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [], error };
    }
  },

  // ============ DEBRIEF NOTES ============
  
  async getAllDebriefs() {
    try {
      const { data, error } = await supabase?.from('debrief_notes')?.select(`
          *,
          session:test_sessions(
            tester:user_testers(email, system, screen_type, browser),
            scenario:test_scenarios(title)
          )
        `)?.order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [], error };
    }
  },

  // ============ STORAGE (SCREENSHOTS) ============
  
  async uploadScreenshot(file, sessionId) {
    try {
      const fileExt = file?.name?.split('.')?.pop();
      const fileName = `${sessionId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase?.storage?.from('test-screenshots')?.upload(fileName, file);

      if (error) throw error;

      // Get signed URL for private bucket
      const { data: urlData, error: urlError } = await supabase?.storage?.from('test-screenshots')?.createSignedUrl(fileName, 31536000); // 1 year expiry

      if (urlError) throw urlError;

      return { data: { path: fileName, url: urlData?.signedUrl }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getScreenshotUrl(filePath) {
    try {
      const { data, error } = await supabase?.storage?.from('test-screenshots')?.createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      return { data: data?.signedUrl, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
};

export default userTestingService;
