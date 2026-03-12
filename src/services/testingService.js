import { supabase } from '../lib/supabase';

/**
 * User Testing Service
 * Handles all operations for the user testing system
 */

const testingService = {
  /**
   * Check if current user is an authorized tester
   */
  checkTesterStatus: async (email) => {
    try {
      const { data, error } = await supabase?.from('user_testers')?.select('*')?.eq('email', email)?.eq('is_active', true)?.single();

      if (error && error?.code !== 'PGRST116') {
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Erreur de vérification du statut participant :', error);
      return { data: null, error };
    }
  },

  /**
   * Update tester context (system, screen, browser)
   */
  updateTesterContext: async (testerId, context) => {
    try {
      const { data, error } = await supabase?.from('user_testers')?.update({
          system: context?.system,
          screen_type: context?.screenType,
          browser: context?.browser,
          updated_at: new Date()?.toISOString()
        })?.eq('id', testerId)?.select()?.single();

      return { data, error };
    } catch (error) {
      console.error('Erreur de mise à jour du contexte participant :', error);
      return { data: null, error };
    }
  },

  /**
   * Get all active test scenarios
   */
  getActiveScenarios: async () => {
    try {
      const { data, error } = await supabase?.from('test_scenarios')?.select('*')?.eq('is_active', true)?.order('created_at', { ascending: false });

      return { data, error };
    } catch (error) {
      console.error('Erreur de récupération des scénarios actifs :', error);
      return { data: null, error };
    }
  },

  /**
   * Get scenario by ID
   */
  getScenarioById: async (scenarioId) => {
    try {
      const { data, error } = await supabase?.from('test_scenarios')?.select('*')?.eq('id', scenarioId)?.single();

      return { data, error };
    } catch (error) {
      console.error('Erreur de récupération du scénario par identifiant :', error);
      return { data: null, error };
    }
  },

  /**
   * Create new test session
   */
  createTestSession: async (testerId, scenarioId) => {
    try {
      const { data, error } = await supabase?.from('test_sessions')?.insert({
          tester_id: testerId,
          scenario_id: scenarioId,
          status: 'in_progress',
          started_at: new Date()?.toISOString()
        })?.select()?.single();

      return { data, error };
    } catch (error) {
      console.error('Erreur de création de la session d\'essai :', error);
      return { data: null, error };
    }
  },

  /**
   * Get active test session for tester
   */
  getActiveSession: async (testerId) => {
    try {
      const { data, error } = await supabase?.from('test_sessions')?.select(`
          *,
          test_scenarios (*)
        `)?.eq('tester_id', testerId)?.eq('status', 'in_progress')?.order('started_at', { ascending: false })?.limit(1)?.single();

      if (error && error?.code !== 'PGRST116') {
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Erreur de récupération de la session active :', error);
      return { data: null, error };
    }
  },

  /**
   * Save page response (coh?rence question)
   */
  savePageResponse: async (sessionId, pageUrl, responseData) => {
    try {
      const { data, error } = await supabase?.from('page_responses')?.insert({
          session_id: sessionId,
          page_url: pageUrl,
          coherence_question: responseData?.coherenceQuestion,
          coherence_answer: responseData?.coherenceAnswer,
          exit_questionnaire: responseData?.exitQuestionnaire || {},
          perceived_info: responseData?.perceivedInfo,
          next_action_understood: responseData?.nextActionUnderstood,
          time_spent_seconds: responseData?.timeSpentSeconds,
          timestamp: new Date()?.toISOString()
        })?.select()?.single();

      return { data, error };
    } catch (error) {
      console.error('Erreur d\'enregistrement de la réponse de page :', error);
      return { data: null, error };
    }
  },

  /**
   * Update page response (exit questionnaire)
   */
  updatePageResponse: async (responseId, exitData) => {
    try {
      const { data, error } = await supabase?.from('page_responses')?.update({
          exit_questionnaire: exitData?.exitQuestionnaire,
          perceived_info: exitData?.perceivedInfo,
          next_action_understood: exitData?.nextActionUnderstood,
          time_spent_seconds: exitData?.timeSpentSeconds
        })?.eq('id', responseId)?.select()?.single();

      return { data, error };
    } catch (error) {
      console.error('Erreur de mise à jour de la réponse de page :', error);
      return { data: null, error };
    }
  },

  /**
   * Get page responses for session
   */
  getPageResponses: async (sessionId) => {
    try {
      const { data, error } = await supabase?.from('page_responses')?.select('*')?.eq('session_id', sessionId)?.order('timestamp', { ascending: true });

      return { data, error };
    } catch (error) {
      console.error('Erreur de récupération des réponses de page :', error);
      return { data: null, error };
    }
  },

  /**
   * Create problem report
   */
  createProblemReport: async (sessionId, reportData) => {
    try {
      const { data, error } = await supabase?.from('test_reports')?.insert({
          session_id: sessionId,
          page_url: reportData?.pageUrl,
          severity: reportData?.severity,
          description: reportData?.description,
          reproduction_steps: reportData?.reproductionSteps,
          screenshot_urls: reportData?.screenshotUrls || []
        })?.select()?.single();

      return { data, error };
    } catch (error) {
      console.error('Erreur de création du signalement de problème :', error);
      return { data: null, error };
    }
  },

  /**
   * Téléverser une capture d'écran dans le compartiment test-screenshots
   */
  uploadScreenshot: async (file, sessionId) => {
    try {
      const fileExt = file?.name?.split('.')?.pop();
      const fileName = `${sessionId}/${Date.now()}-${Math.random()?.toString(36)?.substring(7)}.${fileExt}`;

      const { data, error } = await supabase?.storage
        ?.from('test-screenshots')
        ?.upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        return { data: null, error };
      }

      const { data: { publicUrl } } = supabase?.storage
        ?.from('test-screenshots')
        ?.getPublicUrl(fileName);

      return { data: { path: fileName, url: publicUrl }, error: null };
    } catch (error) {
      console.error("Erreur de téléversement de capture d'écran :", error);
      return { data: null, error };
    }
  },

  /**
   * Complete test session with debrief
   */
  completeSession: async (sessionId, debriefData) => {
    try {
      // Update session status
      const { error: sessionError } = await supabase?.from('test_sessions')?.update({
          status: 'completed',
          completed_at: new Date()?.toISOString()
        })?.eq('id', sessionId);

      if (sessionError) {
        return { data: null, error: sessionError };
      }

      // Save debrief notes
      const { data, error } = await supabase?.from('debrief_notes')?.insert({
          session_id: sessionId,
          what_was_clear: debriefData?.whatWasClear,
          what_blocked: debriefData?.whatBlocked,
          confidence_level: debriefData?.confidenceLevel,
          notes: debriefData?.notes
        })?.select()?.single();

      return { data, error };
    } catch (error) {
      console.error('Erreur de finalisation de session :', error);
      return { data: null, error };
    }
  },

  /**
   * Get all test sessions (admin)
   */
  getAllSessions: async () => {
    try {
      const { data, error } = await supabase?.from('test_sessions')?.select(`
          *,
          user_testers (*),
          test_scenarios (*)
        `)?.order('started_at', { ascending: false });

      return { data, error };
    } catch (error) {
      console.error('Erreur de récupération de toutes les sessions :', error);
      return { data: null, error };
    }
  },

  /**
   * Get all problem reports (admin)
   */
  getAllReports: async () => {
    try {
      const { data, error } = await supabase?.from('test_reports')?.select(`
          *,
          test_sessions (
            *,
            user_testers (*),
            test_scenarios (*)
          )
        `)?.order('created_at', { ascending: false });

      return { data, error };
    } catch (error) {
      console.error('Erreur de récupération de tous les signalements :', error);
      return { data: null, error };
    }
  },

  /**
   * Get confusion analysis (admin)
   */
  getConfusionAnalysis: async () => {
    try {
      const { data, error } = await supabase?.from('page_responses')?.select('page_url, coherence_answer, next_action_understood')?.order('page_url');

      return { data, error };
    } catch (error) {
      console.error('Erreur de récupération de l\'analyse de confusion :', error);
      return { data: null, error };
    }
  },

  /**
   * Create test scenario (admin)
   */
  createScenario: async (scenarioData) => {
    try {
      const { data, error } = await supabase?.from('test_scenarios')?.insert({
          title: scenarioData?.title,
          objective: scenarioData?.objective,
          expected_result: scenarioData?.expectedResult,
          instructions: scenarioData?.instructions,
          pages: scenarioData?.pages || [],
          is_active: scenarioData?.isActive !== false
        })?.select()?.single();

      return { data, error };
    } catch (error) {
      console.error('Erreur de création de scénario :', error);
      return { data: null, error };
    }
  },

  /**
   * Update test scenario (admin)
   */
  updateScenario: async (scenarioId, scenarioData) => {
    try {
      const { data, error } = await supabase?.from('test_scenarios')?.update({
          title: scenarioData?.title,
          objective: scenarioData?.objective,
          expected_result: scenarioData?.expectedResult,
          instructions: scenarioData?.instructions,
          pages: scenarioData?.pages,
          is_active: scenarioData?.isActive,
          updated_at: new Date()?.toISOString()
        })?.eq('id', scenarioId)?.select()?.single();

      return { data, error };
    } catch (error) {
      console.error('Erreur de mise à jour de scénario :', error);
      return { data: null, error };
    }
  },

  /**
   * Add authorized tester (admin)
   */
  addTester: async (email, protocolGroup) => {
    try {
      const { data, error } = await supabase?.from('user_testers')?.insert({
          email,
          protocol_group: protocolGroup,
          is_active: true
        })?.select()?.single();

      return { data, error };
    } catch (error) {
      console.error('Erreur d\'ajout de participant :', error);
      return { data: null, error };
    }
  },

  /**
   * Remove tester (admin)
   */
  removeTester: async (testerId) => {
    try {
      const { error } = await supabase?.from('user_testers')?.update({ is_active: false })?.eq('id', testerId);

      return { error };
    } catch (error) {
      console.error('Erreur de retrait de participant :', error);
      return { error };
    }
  }
};

export default testingService;

