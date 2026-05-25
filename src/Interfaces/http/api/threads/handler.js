const AddThreadUseCase = require('../../../../Applications/use_case/AddThreadUseCase');
const GetThreadsUseCase = require('../../../../Applications/use_case/GetThreadsUseCase');
const GetThreadDetailUseCase = require('../../../../Applications/use_case/GetThreadDetailUseCase');

class ThreadsHandler {
  constructor(container) {
    this._container = container;

    this.postThreadHandler = this.postThreadHandler.bind(this);
    this.getThreadsHandler = this.getThreadsHandler.bind(this);
    this.getThreadByIdHandler = this.getThreadByIdHandler.bind(this);
  }

  async postThreadHandler(request, h) {
    const addThreadUseCase = this._container.getInstance(AddThreadUseCase.name);
    const { id: credentialId } = request.auth.credentials;

    const addedThread = await addThreadUseCase.execute({
      title: request.payload.title,
      body: request.payload.body,
      owner: credentialId,
    });

    const response = h.response({
      status: 'success',
      data: {
        addedThread,
      },
    });
    response.code(201);
    return response;
  }

  async getThreadsHandler() {
    const getThreadsUseCase = this._container.getInstance(GetThreadsUseCase.name);
    const threads = await getThreadsUseCase.execute();

    return {
      status: 'success',
      data: {
        threads,
      },
    };
  }

  async getThreadByIdHandler(request, h) {
    const getThreadDetailUseCase = this._container.getInstance(GetThreadDetailUseCase.name);
    const { threadId } = request.params;

    const thread = await getThreadDetailUseCase.execute({ threadId });

    const response = h.response({
      status: 'success',
      data: {
        thread,
      },
    });
    response.code(200);
    return response;
  }
}

module.exports = ThreadsHandler;
