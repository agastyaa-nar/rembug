class DeleteCommentUseCase {
  constructor({ threadRepository, commentRepository }) {
    this._threadRepository = threadRepository;
    this._commentRepository = commentRepository;
  }

  async execute(useCasePayload) {
    const { threadId, commentId, owner } = useCasePayload;

    // Pastikan thread ada. Jika tidak, repository akan melempar NotFoundError.
    await this._threadRepository.verifyThreadExist(threadId);

    // Pastikan komentar ada dan dimiliki owner.
    await this._commentRepository.verifyCommentOwner(commentId, owner);

    await this._commentRepository.deleteComment(commentId);
  }
}

module.exports = DeleteCommentUseCase;
