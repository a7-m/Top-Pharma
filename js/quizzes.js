// Quizzes Service

let currentQuiz = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let quizTimer = null;
let timeRemaining = 0;

/**
 * Get all quizzes
 */
async function getAllQuizzes() {
    try {
        const { data, error } = await supabaseClient
            .from('quizzes')
            .select('*, questions(count)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        showError('حدث خطأ أثناء تحميل الاختبارات');
        return [];
    }
}

/**
 * Render quiz cards
 */
function renderQuizCards(quizzes, containerId, isAdmin = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (quizzes.length === 0) {
        container.innerHTML = '<p class="no-data">لا توجد اختبارات متاحة حاليًا</p>';
        return;
    }

    container.innerHTML = quizzes.map(quiz => {
        const questionsCount = Array.isArray(quiz.questions) && quiz.questions.length > 0
            ? quiz.questions[0].count
            : 0;
        return `
            <div class="quiz-card">
                <div class="quiz-header">
                    <div>
                        <h3>${quiz.title}</h3>
                        <p style="color: var(--gray); margin-bottom: 0.5rem;">${quiz.description || ''}</p>
                    </div>
                </div>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap; color: var(--gray); font-size: var(--font-size-sm); margin-bottom: 1rem;">
                    <span>عدد الأسئلة: ${questionsCount}</span>
                    <span>درجة النجاح: ${quiz.passing_score || 50}%</span>
                    <span>الوقت: ${quiz.time_limit ? `${quiz.time_limit} دقيقة` : 'بدون وقت'}</span>
                </div>
                <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                    <button class="btn btn-primary btn-sm quiz-start-btn"
                            data-quiz-id="${quiz.id}"
                            data-subject-id="${quiz.subject_id || ''}">
                        بدء الاختبار
                    </button>
                    ${isAdmin ? `
                    <button class="btn btn-sm btn-info" onclick="window.location.href='admin/create-quiz.html?id=${quiz.id}'">تعديل</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteQuiz('${quiz.id}')">حذف</button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.quiz-start-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const quizId = button.dataset.quizId;
            const subjectId = button.dataset.subjectId || null;
            const nextUrl = `quiz-take.html?id=${quizId}${subjectId ? `&subject=${subjectId}` : ''}`;
            const canAccess = await requireSubjectAccess(subjectId, nextUrl);
            if (!canAccess) return;
            window.location.href = nextUrl;
        });
    });
}

/**
 * Get quiz by ID with questions
 */
async function getQuizById(quizId) {
    try {
        const { data: quiz, error: quizError } = await supabaseClient
            .from('quizzes')
            .select('*')
            .eq('id', quizId)
            .single();

        if (quizError) throw quizError;

        const { data: questions, error: questionsError } = await supabaseClient
            .from('questions')
            .select('*')
            .eq('quiz_id', quizId)
            .order('order', { ascending: true });

        if (questionsError) throw questionsError;

        return { ...quiz, questions };
    } catch (error) {
        console.error('Error fetching quiz:', error);
        return null;
    }
}

/**
 * Start quiz
 */
function startQuiz(quiz) {
    currentQuiz = quiz;
    currentQuestions = quiz.questions;
    currentQuestionIndex = 0;
    userAnswers = {};
    
    if (quiz.time_limit) {
        timeRemaining = quiz.time_limit * 60; // Convert to seconds
        startTimer();
    }
    
    displayQuestion();
}

/**
 * Start timer
 */
function startTimer() {
    const timerElement = document.getElementById('quiz-timer');
    
    quizTimer = setInterval(() => {
        timeRemaining--;
        
        if (timerElement) {
            const minutes = Math.floor(timeRemaining / 60);
            const seconds = timeRemaining % 60;
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        if (timeRemaining <= 0) {
            clearInterval(quizTimer);
            submitQuiz();
        }
    }, 1000);
}

/**
 * Display current question
 */
function displayQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    const container = document.getElementById('question-container');
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="question-header">
            <span class="question-number">السؤال ${currentQuestionIndex + 1} من ${currentQuestions.length}</span>
        </div>
        <div class="question-text">
            <h3>${question.question_text}</h3>
        </div>
        <div class="question-options">
            ${question.options.map((option, index) => `
                <label class="option-label">
                    <input type="radio" 
                           name="answer" 
                           value="${index}"
                           ${userAnswers[question.id] === index ? 'checked' : ''}
                           onchange="selectAnswer('${question.id}', ${index})">
                    <span class="option-text">${option}</span>
                </label>
            `).join('')}
        </div>
        <div class="question-navigation">
            <button class="btn btn-secondary" 
                    onclick="previousQuestion()" 
                    ${currentQuestionIndex === 0 ? 'disabled' : ''}>
                السابق
            </button>
            <button class="btn btn-primary" 
                    onclick="${currentQuestionIndex === currentQuestions.length - 1 ? 'submitQuiz()' : 'nextQuestion()'}">
                ${currentQuestionIndex === currentQuestions.length - 1 ? 'إنهاء الاختبار' : 'التالي'}
            </button>
        </div>
    `;
}

/**
 * Select answer
 */
function selectAnswer(questionId, answerIndex) {
    userAnswers[questionId] = answerIndex;
}

/**
 * Next question
 */
function nextQuestion() {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
    }
}

/**
 * Previous question
 */
function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

/**
 * Calculate score
 */
function calculateScore() {
    let correctAnswers = 0;
    
    currentQuestions.forEach(question => {
        if (userAnswers[question.id] === question.correct_answer) {
            correctAnswers++;
        }
    });
    
    return Math.round((correctAnswers / currentQuestions.length) * 100);
}

/**
 * Submit quiz
 */
async function submitQuiz() {
    if (quizTimer) {
        clearInterval(quizTimer);
    }
    
    const score = calculateScore();
    const user = await getCurrentUser();
    
    try {
        // Save attempt to database
        const { error } = await supabaseClient
            .from('quiz_attempts')
            .insert([
                {
                    user_id: user.id,
                    quiz_id: currentQuiz.id,
                    score: score,
                    answers: userAnswers,
                    completed_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;
        
        // Show results
        displayResults(score);
    } catch (error) {
        console.error('Error submitting quiz:', error);
        showError('حدث خطأ أثناء حفظ النتيجة');
    }
}

/**
 * Display results
 */
function displayResults(score) {
    const container = document.getElementById('question-container');
    const isPassed = score >= (currentQuiz.passing_score || 50);
    const correctCount = currentQuestions.filter(q => userAnswers[q.id] === q.correct_answer).length;
    
    container.innerHTML = `
        <div class="quiz-results">
            <div class="result-icon ${isPassed ? 'success' : 'fail'}">
                ${isPassed ? '✓' : '✗'}
            </div>
            <h2>${isPassed ? 'تهانينا!' : 'للأسف'}</h2>
            <div class="score-circle">
                <span class="score-number">${score}%</span>
            </div>
            <p class="result-message">
                ${isPassed 
                    ? 'لقد اجتزت الاختبار بنجاح!' 
                    : 'لم تحصل على الدرجة المطلوبة. حاول مرة أخرى!'}
            </p>
            
            <div class="result-summary">
                 <p>عدد الأسئلة: ${currentQuestions.length}</p>
                 <p>الإجابات الصحيحة: ${correctCount}</p>
                 <p>الإجابات الخاطئة: ${currentQuestions.length - correctCount}</p>
            </div>

            <div class="result-actions">
                <button class="btn btn-secondary" onclick="shareResult(${score})">
                    <i class="fas fa-share-alt"></i> مشاركة النتيجة
                </button>
                <button class="btn btn-info" onclick="toggleDetails()">
                    <i class="fas fa-eye"></i> تفاصيل النتيجة
                </button>
                <button class="btn btn-primary" onclick="window.location.href='quizzes.html'">
                    العودة للاختبارات
                </button>
                <button class="btn btn-secondary" onclick="window.location.reload()">
                    إعادة المحاولة
                </button>
            </div>

            <div id="result-details" class="result-details" style="display: none; margin-top: 20px; text-align: right;">
                <h3>تفاصيل الإجابات</h3>
                ${currentQuestions.map((q, index) => {
                    const isCorrect = userAnswers[q.id] === q.correct_answer;
                    const userAnswerIndex = userAnswers[q.id];
                    const correctAnswerIndex = q.correct_answer;
                    
                    return `
                        <div class="question-review" style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 8px; background-color: ${isCorrect ? '#e8f5e9' : '#ffebee'}">
                            <h4>س${index + 1}: ${q.question_text}</h4>
                            <div class="options-review">
                                ${q.options.map((opt, optIndex) => {
                                    let style = '';
                                    let icon = '';
                                    
                                    if (optIndex === correctAnswerIndex) {
                                        style = 'color: green; font-weight: bold;';
                                        icon = '✓';
                                    } else if (optIndex === userAnswerIndex && !isCorrect) {
                                        style = 'color: red; text-decoration: line-through;';
                                        icon = '✗';
                                    }
                                    
                                    return `<div style="${style}">${opt} ${icon}</div>`;
                                }).join('')}
                            </div>
                            ${!isCorrect && userAnswerIndex === undefined ? '<p style="color: orange;">لم يتم الإجابة</p>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * Toggle details visibility
 */
window.toggleDetails = function() {
    const details = document.getElementById('result-details');
    if (details.style.display === 'none') {
        details.style.display = 'block';
    } else {
        details.style.display = 'none';
    }
};

/**
 * Share result
 */
window.shareResult = function(score) {
    const text = `لقد حصلت على ${score}% في اختبار "${currentQuiz.title}" على منصة Top Pharma!`;
    if (navigator.share) {
        navigator.share({
            title: 'نتيجتي في الاختبار',
            text: text,
            url: window.location.href
        }).catch(err => console.log('Error sharing:', err));
    } else {
        navigator.clipboard.writeText(text).then(() => {
            alert('تم نسخ النتيجة للحافظة!');
        });
    }
};

/**
 * Get user's quiz attempts
 */
async function getUserAttempts(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('quiz_attempts')
            .select('*, quizzes(title)')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching attempts:', error);
        return [];
    }
}

/**
 * Delete quiz
 */
async function deleteQuiz(quizId) {
    if (!confirm('هل أنت متأكد من حذف هذا الاختبار؟ سيتم حذف جميع الأسئلة والنتائج المرتبطة به.')) return;
    
    try {
        const { error } = await supabaseClient
            .from('quizzes')
            .delete()
            .eq('id', quizId);
            
        if (error) throw error;
        
        alert('تم حذف الاختبار بنجاح');
        window.location.reload();
    } catch (error) {
        console.error('Error deleting quiz:', error);
        alert('حدث خطأ أثناء الحذف');
    }
}
