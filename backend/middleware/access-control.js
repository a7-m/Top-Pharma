// backend/middleware/access-control.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Check if user has access to a specific section
 */
async function checkSectionAccess(userId, sectionId) {
  try {
    // Check if user has access to the section
    const { data, error } = await supabase
      .from('section_access')
      .select('*')
      .eq('user_id', userId)
      .eq('section_id', sectionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking section access:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('checkSectionAccess error:', err);
    return false;
  }
}

/**
 * Check if user has access to a specific video
 */
async function checkVideoAccess(userId, videoId) {
  try {
    // Get the video and its section
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('section_id')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return false;
    }

    // Check section access
    return await checkSectionAccess(userId, video.section_id);
  } catch (err) {
    console.error('checkVideoAccess error:', err);
    return false;
  }
}

/**
 * Check if user has access to a specific quiz
 */
async function checkQuizAccess(userId, quizId) {
  try {
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('section_id')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      return false;
    }

    return await checkSectionAccess(userId, quiz.section_id);
  } catch (err) {
    console.error('checkQuizAccess error:', err);
    return false;
  }
}

/**
 * Check if user has access to a specific file
 */
async function checkFileAccess(userId, fileId) {
  try {
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('section_id')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      return false;
    }

    return await checkSectionAccess(userId, file.section_id);
  } catch (err) {
    console.error('checkFileAccess error:', err);
    return false;
  }
}

module.exports = {
  checkSectionAccess,
  checkVideoAccess,
  checkQuizAccess,
  checkFileAccess
};
