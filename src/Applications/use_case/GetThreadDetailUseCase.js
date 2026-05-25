const DetailThread = require('../../Domains/threads/entities/DetailThread');
const DetailComment = require('../../Domains/comments/entities/DetailComment');
const DetailReply = require('../../Domains/replies/entities/DetailReply');

class GetThreadDetailUseCase {
  constructor({
    threadRepository,
    commentRepository,
    replyRepository,
    commentLikeRepository,
  }) {
    this._threadRepository = threadRepository;
    this._commentRepository = commentRepository;
    this._replyRepository = replyRepository;
    this._commentLikeRepository = commentLikeRepository;
  }

  async execute(useCasePayload) {
    const { threadId } = useCasePayload;

    const thread = await this._threadRepository.getThreadById(threadId);
    const comments = await this._commentRepository.getCommentsByThreadId(threadId);
    const replies = await this._replyRepository.getRepliesByThreadId(threadId);
    const commentIds = comments.map((comment) => comment.id);
    const likeCounts = await this._commentLikeRepository
      .getLikeCountsByCommentIds(commentIds);

    const repliesByCommentId = {};
    replies.forEach((reply) => {
      const detailReply = new DetailReply(reply);
      const commentId = reply.comment_id || reply.commentId;

      if (!repliesByCommentId[commentId]) {
        repliesByCommentId[commentId] = [];
      }

      repliesByCommentId[commentId].push(detailReply);
    });

    const detailComments = comments.map((comment) => new DetailComment({
      ...comment,
      likeCount: likeCounts[comment.id] || 0,
      replies: repliesByCommentId[comment.id] || [],
    }));

    return new DetailThread({
      id: thread.id,
      title: thread.title,
      body: thread.body,
      date: thread.date,
      username: thread.username,
      comments: detailComments,
    });
  }
}

module.exports = GetThreadDetailUseCase;
